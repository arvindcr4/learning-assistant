package test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	policyv1beta1 "k8s.io/api/policy/v1beta1"
	rbacv1 "k8s.io/api/rbac/v1"
	storagev1 "k8s.io/api/storage/v1"
	autoscalingv1 "k8s.io/api/autoscaling/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	batchv1 "k8s.io/api/batch/v1"
	batchv1beta1 "k8s.io/api/batch/v1beta1"
	extensionsv1beta1 "k8s.io/api/extensions/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/rest"
	"k8s.io/metrics/pkg/client/clientset/versioned"
	
	"github.com/gruntwork-io/terratest/modules/k8s"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/gruntwork-io/terratest/modules/test-structure"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/files"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/rs/zerolog/log"
	"github.com/pkg/errors"
	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

// K8sTestSuite manages Kubernetes infrastructure tests
type K8sTestSuite struct {
	KubeconfigPath string
	Namespace      string
	TestID         string
	Config         TestConfig
	Logger         zerolog.Logger
	Context        context.Context
	
	// Kubernetes clients
	Clientset        *kubernetes.Clientset
	MetricsClientset *versioned.Clientset
	RestConfig       *rest.Config
	
	// Test options
	KubectlOptions   *k8s.KubectlOptions
	
	// Test resources
	TestNamespaces   []string
	TestDeployments  []string
	TestServices     []string
	TestIngresses    []string
	TestConfigMaps   []string
	TestSecrets      []string
	TestPVCs         []string
	TestJobs         []string
	TestCronJobs     []string
	TestHPAs         []string
	TestPodSecurityPolicies []string
	TestNetworkPolicies []string
	TestServiceAccounts []string
	TestRoles        []string
	TestRoleBindings []string
	TestClusterRoles []string
	TestClusterRoleBindings []string
	TestStorageClasses []string
}

// K8sResource represents a Kubernetes resource for testing
type K8sResource struct {
	APIVersion string                 `yaml:"apiVersion"`
	Kind       string                 `yaml:"kind"`
	Metadata   metav1.ObjectMeta      `yaml:"metadata"`
	Spec       map[string]interface{} `yaml:"spec,omitempty"`
	Data       map[string]string      `yaml:"data,omitempty"`
	StringData map[string]string      `yaml:"stringData,omitempty"`
}

// K8sTestManifest represents a test manifest configuration
type K8sTestManifest struct {
	Name        string                 `yaml:"name"`
	Description string                 `yaml:"description"`
	Resources   []K8sResource          `yaml:"resources"`
	Tests       []K8sResourceTest      `yaml:"tests"`
	Cleanup     bool                   `yaml:"cleanup"`
	Timeout     time.Duration          `yaml:"timeout"`
	RetryCount  int                    `yaml:"retryCount"`
}

// K8sResourceTest represents a test for a Kubernetes resource
type K8sResourceTest struct {
	Name        string            `yaml:"name"`
	Type        string            `yaml:"type"` // deployment, service, pod, etc.
	Namespace   string            `yaml:"namespace"`
	Resource    string            `yaml:"resource"`
	Conditions  []TestCondition   `yaml:"conditions"`
	Metrics     []MetricTest      `yaml:"metrics"`
	Security    SecurityTest      `yaml:"security"`
	Performance PerformanceTest   `yaml:"performance"`
}

// TestCondition represents a condition to test
type TestCondition struct {
	Field    string      `yaml:"field"`
	Operator string      `yaml:"operator"` // equals, contains, exists, greater_than, less_than
	Value    interface{} `yaml:"value"`
	Message  string      `yaml:"message"`
}

// MetricTest represents a metric test
type MetricTest struct {
	Name      string  `yaml:"name"`
	Metric    string  `yaml:"metric"` // cpu, memory, network, disk
	Threshold float64 `yaml:"threshold"`
	Unit      string  `yaml:"unit"`
}

// SecurityTest represents security tests
type SecurityTest struct {
	PodSecurityPolicy bool                    `yaml:"podSecurityPolicy"`
	NetworkPolicy     bool                    `yaml:"networkPolicy"`
	RBAC              bool                    `yaml:"rbac"`
	ServiceAccount    bool                    `yaml:"serviceAccount"`
	Secrets           bool                    `yaml:"secrets"`
	SecurityContext   SecurityContextTest     `yaml:"securityContext"`
	ImageSecurity     ImageSecurityTest       `yaml:"imageSecurity"`
}

// SecurityContextTest represents security context tests
type SecurityContextTest struct {
	RunAsNonRoot             bool `yaml:"runAsNonRoot"`
	ReadOnlyRootFilesystem   bool `yaml:"readOnlyRootFilesystem"`
	AllowPrivilegeEscalation bool `yaml:"allowPrivilegeEscalation"`
	DropCapabilities         bool `yaml:"dropCapabilities"`
}

// ImageSecurityTest represents image security tests
type ImageSecurityTest struct {
	NoLatestTag      bool     `yaml:"noLatestTag"`
	ScanVulnerabilities bool  `yaml:"scanVulnerabilities"`
	TrustedRegistry  bool     `yaml:"trustedRegistry"`
	AllowedRegistries []string `yaml:"allowedRegistries"`
}

// PerformanceTest represents performance tests
type PerformanceTest struct {
	ResourceLimits   bool                   `yaml:"resourceLimits"`
	ResourceRequests bool                   `yaml:"resourceRequests"`
	HPA              bool                   `yaml:"hpa"`
	LoadTest         LoadTest               `yaml:"loadTest"`
	Scaling          ScalingTest            `yaml:"scaling"`
}

// LoadTest represents load testing configuration
type LoadTest struct {
	Enabled       bool          `yaml:"enabled"`
	Duration      time.Duration `yaml:"duration"`
	Concurrency   int           `yaml:"concurrency"`
	RequestsPerSecond int       `yaml:"requestsPerSecond"`
	TargetURL     string        `yaml:"targetUrl"`
}

// ScalingTest represents scaling test configuration
type ScalingTest struct {
	Enabled    bool `yaml:"enabled"`
	MinReplicas int  `yaml:"minReplicas"`
	MaxReplicas int  `yaml:"maxReplicas"`
	TargetCPU  int  `yaml:"targetCpu"`
}

// NewK8sTestSuite creates a new Kubernetes test suite
func NewK8sTestSuite(kubeconfigPath, namespace string, config TestConfig) (*K8sTestSuite, error) {
	testID := uuid.New().String()[:8]
	ctx := context.Background()
	
	// Initialize logger
	logger := log.With().
		Str("service", "k8s-test-suite").
		Str("namespace", namespace).
		Str("test_id", testID).
		Logger()

	// Create kubectl options
	kubectlOptions := k8s.NewKubectlOptions("", kubeconfigPath, namespace)
	
	// Create Kubernetes client configuration
	restConfig, err := clientcmd.BuildConfigFromFlags("", kubeconfigPath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to build rest config")
	}

	// Create Kubernetes clientset
	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create clientset")
	}

	// Create metrics clientset
	metricsClientset, err := versioned.NewForConfig(restConfig)
	if err != nil {
		logger.Warn().Err(err).Msg("Failed to create metrics clientset")
	}

	suite := &K8sTestSuite{
		KubeconfigPath:   kubeconfigPath,
		Namespace:        namespace,
		TestID:           testID,
		Config:           config,
		Logger:           logger,
		Context:          ctx,
		Clientset:        clientset,
		MetricsClientset: metricsClientset,
		RestConfig:       restConfig,
		KubectlOptions:   kubectlOptions,
		TestNamespaces:   make([]string, 0),
		TestDeployments:  make([]string, 0),
		TestServices:     make([]string, 0),
		TestIngresses:    make([]string, 0),
		TestConfigMaps:   make([]string, 0),
		TestSecrets:      make([]string, 0),
		TestPVCs:         make([]string, 0),
		TestJobs:         make([]string, 0),
		TestCronJobs:     make([]string, 0),
		TestHPAs:         make([]string, 0),
		TestPodSecurityPolicies: make([]string, 0),
		TestNetworkPolicies: make([]string, 0),
		TestServiceAccounts: make([]string, 0),
		TestRoles:        make([]string, 0),
		TestRoleBindings: make([]string, 0),
		TestClusterRoles: make([]string, 0),
		TestClusterRoleBindings: make([]string, 0),
		TestStorageClasses: make([]string, 0),
	}

	return suite, nil
}

// TestKubernetesInfrastructure runs comprehensive Kubernetes infrastructure tests
func TestKubernetesInfrastructure(t *testing.T) {
	t.Parallel()

	// Load test configuration
	config, err := LoadTestConfig("test-config.yaml")
	require.NoError(t, err)

	// Get kubeconfig path from environment or config
	kubeconfigPath := "~/.kube/config" // This would come from config or environment
	namespace := "default"

	// Create Kubernetes test suite
	suite, err := NewK8sTestSuite(kubeconfigPath, namespace, config)
	require.NoError(t, err)

	suite.Logger.Info().Msg("Starting Kubernetes infrastructure tests")

	// Test stages
	t.Run("Cluster Health", suite.TestClusterHealth)
	t.Run("Nodes", suite.TestNodes)
	t.Run("Namespaces", suite.TestNamespaces)
	t.Run("Deployments", suite.TestDeployments)
	t.Run("Services", suite.TestServices)
	t.Run("Ingresses", suite.TestIngresses)
	t.Run("ConfigMaps", suite.TestConfigMaps)
	t.Run("Secrets", suite.TestSecrets)
	t.Run("Persistent Volumes", suite.TestPersistentVolumes)
	t.Run("Jobs", suite.TestJobs)
	t.Run("CronJobs", suite.TestCronJobs)
	t.Run("HPA", suite.TestHorizontalPodAutoscaler)
	t.Run("RBAC", suite.TestRBAC)
	t.Run("Network Policies", suite.TestNetworkPolicies)
	t.Run("Pod Security Policies", suite.TestPodSecurityPolicies)
	t.Run("Resource Quotas", suite.TestResourceQuotas)
	t.Run("Storage Classes", suite.TestStorageClasses)
	t.Run("Security", suite.TestSecurity)
	t.Run("Performance", suite.TestPerformance)
	t.Run("Monitoring", suite.TestMonitoring)
	t.Run("Backup", suite.TestBackup)
	t.Run("Disaster Recovery", suite.TestDisasterRecovery)
	t.Run("Compliance", suite.TestCompliance)
	t.Run("Chaos Engineering", suite.TestChaosEngineering)

	suite.Logger.Info().Msg("Kubernetes infrastructure tests completed")
}

// TestClusterHealth tests cluster health
func (suite *K8sTestSuite) TestClusterHealth(t *testing.T) {
	suite.Logger.Info().Msg("Testing cluster health")

	// Test cluster info
	t.Run("Cluster Info", func(t *testing.T) {
		// Test cluster version
		version, err := suite.Clientset.Discovery().ServerVersion()
		require.NoError(t, err)
		assert.NotEmpty(t, version.GitVersion, "Cluster should have a version")
		
		suite.Logger.Info().Str("version", version.GitVersion).
			Str("platform", version.Platform).
			Msg("Cluster version")
	})

	// Test API server health
	t.Run("API Server Health", func(t *testing.T) {
		healthz, err := suite.Clientset.Discovery().RESTClient().Get().AbsPath("/healthz").DoRaw(suite.Context)
		require.NoError(t, err)
		assert.Equal(t, "ok", string(healthz), "API server should be healthy")
		
		suite.Logger.Info().Msg("API server is healthy")
	})

	// Test cluster components
	t.Run("Cluster Components", func(t *testing.T) {
		componentStatuses, err := suite.Clientset.CoreV1().ComponentStatuses().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, cs := range componentStatuses.Items {
			suite.Logger.Info().Str("component", cs.Name).
				Interface("conditions", cs.Conditions).
				Msg("Component status")
			
			// Check if component is healthy
			for _, condition := range cs.Conditions {
				if condition.Type == corev1.ComponentHealthy {
					assert.Equal(t, corev1.ConditionTrue, condition.Status, 
						fmt.Sprintf("Component %s should be healthy", cs.Name))
				}
			}
		}
	})

	suite.Logger.Info().Msg("Cluster health tests completed")
}

// TestNodes tests node infrastructure
func (suite *K8sTestSuite) TestNodes(t *testing.T) {
	suite.Logger.Info().Msg("Testing nodes")

	// Test node health
	t.Run("Node Health", func(t *testing.T) {
		nodes, err := suite.Clientset.CoreV1().Nodes().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)
		assert.True(t, len(nodes.Items) > 0, "Cluster should have at least one node")

		for _, node := range nodes.Items {
			// Test node conditions
			for _, condition := range node.Status.Conditions {
				switch condition.Type {
				case corev1.NodeReady:
					assert.Equal(t, corev1.ConditionTrue, condition.Status, 
						fmt.Sprintf("Node %s should be ready", node.Name))
				case corev1.NodeMemoryPressure, corev1.NodeDiskPressure, corev1.NodePIDPressure:
					assert.Equal(t, corev1.ConditionFalse, condition.Status, 
						fmt.Sprintf("Node %s should not have pressure", node.Name))
				case corev1.NodeNetworkUnavailable:
					assert.Equal(t, corev1.ConditionFalse, condition.Status, 
						fmt.Sprintf("Node %s network should be available", node.Name))
				}
			}
			
			// Test node resources
			assert.NotNil(t, node.Status.Capacity, "Node should have capacity")
			assert.NotNil(t, node.Status.Allocatable, "Node should have allocatable resources")
			
			// Log node information
			suite.Logger.Info().Str("node", node.Name).
				Str("os", node.Status.NodeInfo.OperatingSystem).
				Str("arch", node.Status.NodeInfo.Architecture).
				Str("kernel", node.Status.NodeInfo.KernelVersion).
				Str("container_runtime", node.Status.NodeInfo.ContainerRuntimeVersion).
				Str("kubelet", node.Status.NodeInfo.KubeletVersion).
				Interface("capacity", node.Status.Capacity).
				Msg("Node information")
		}
	})

	// Test node metrics
	t.Run("Node Metrics", func(t *testing.T) {
		if suite.MetricsClientset == nil {
			t.Skip("Metrics client not available")
			return
		}

		nodeMetrics, err := suite.MetricsClientset.MetricsV1beta1().NodeMetricses().List(suite.Context, metav1.ListOptions{})
		if err != nil {
			suite.Logger.Warn().Err(err).Msg("Failed to get node metrics")
			return
		}

		for _, metric := range nodeMetrics.Items {
			suite.Logger.Info().Str("node", metric.Name).
				Str("cpu", metric.Usage.Cpu().String()).
				Str("memory", metric.Usage.Memory().String()).
				Msg("Node metrics")
		}
	})

	suite.Logger.Info().Msg("Node tests completed")
}

// TestNamespaces tests namespace infrastructure
func (suite *K8sTestSuite) TestNamespaces(t *testing.T) {
	suite.Logger.Info().Msg("Testing namespaces")

	// Test namespace health
	t.Run("Namespace Health", func(t *testing.T) {
		namespaces, err := suite.Clientset.CoreV1().Namespaces().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)
		assert.True(t, len(namespaces.Items) > 0, "Cluster should have namespaces")

		for _, ns := range namespaces.Items {
			// Test namespace phase
			assert.Equal(t, corev1.NamespaceActive, ns.Status.Phase, 
				fmt.Sprintf("Namespace %s should be active", ns.Name))
			
			suite.Logger.Info().Str("namespace", ns.Name).
				Str("phase", string(ns.Status.Phase)).
				Time("created", ns.CreationTimestamp.Time).
				Msg("Namespace information")
		}
	})

	// Test namespace resource quotas
	t.Run("Namespace Resource Quotas", func(t *testing.T) {
		namespaces, err := suite.Clientset.CoreV1().Namespaces().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, ns := range namespaces.Items {
			quotas, err := suite.Clientset.CoreV1().ResourceQuotas(ns.Name).List(suite.Context, metav1.ListOptions{})
			require.NoError(t, err)

			for _, quota := range quotas.Items {
				suite.Logger.Info().Str("namespace", ns.Name).
					Str("quota", quota.Name).
					Interface("hard", quota.Status.Hard).
					Interface("used", quota.Status.Used).
					Msg("Resource quota")
			}
		}
	})

	suite.Logger.Info().Msg("Namespace tests completed")
}

// TestDeployments tests deployment infrastructure
func (suite *K8sTestSuite) TestDeployments(t *testing.T) {
	suite.Logger.Info().Msg("Testing deployments")

	// Test deployment health
	t.Run("Deployment Health", func(t *testing.T) {
		deployments, err := suite.Clientset.AppsV1().Deployments("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, deployment := range deployments.Items {
			// Test deployment conditions
			for _, condition := range deployment.Status.Conditions {
				if condition.Type == appsv1.DeploymentProgressing {
					assert.Equal(t, corev1.ConditionTrue, condition.Status, 
						fmt.Sprintf("Deployment %s should be progressing", deployment.Name))
				}
				if condition.Type == appsv1.DeploymentAvailable {
					assert.Equal(t, corev1.ConditionTrue, condition.Status, 
						fmt.Sprintf("Deployment %s should be available", deployment.Name))
				}
			}
			
			// Test replica status
			assert.Equal(t, deployment.Status.ReadyReplicas, deployment.Status.Replicas, 
				fmt.Sprintf("Deployment %s should have all replicas ready", deployment.Name))
			
			suite.Logger.Info().Str("deployment", deployment.Name).
				Str("namespace", deployment.Namespace).
				Int32("replicas", deployment.Status.Replicas).
				Int32("ready_replicas", deployment.Status.ReadyReplicas).
				Int32("available_replicas", deployment.Status.AvailableReplicas).
				Msg("Deployment status")
		}
	})

	// Test deployment security
	t.Run("Deployment Security", func(t *testing.T) {
		deployments, err := suite.Clientset.AppsV1().Deployments("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, deployment := range deployments.Items {
			// Test security context
			for _, container := range deployment.Spec.Template.Spec.Containers {
				if container.SecurityContext != nil {
					// Test run as non-root
					if container.SecurityContext.RunAsNonRoot != nil {
						assert.True(t, *container.SecurityContext.RunAsNonRoot, 
							fmt.Sprintf("Container %s should run as non-root", container.Name))
					}
					
					// Test read-only root filesystem
					if container.SecurityContext.ReadOnlyRootFilesystem != nil {
						assert.True(t, *container.SecurityContext.ReadOnlyRootFilesystem, 
							fmt.Sprintf("Container %s should have read-only root filesystem", container.Name))
					}
					
					// Test privilege escalation
					if container.SecurityContext.AllowPrivilegeEscalation != nil {
						assert.False(t, *container.SecurityContext.AllowPrivilegeEscalation, 
							fmt.Sprintf("Container %s should not allow privilege escalation", container.Name))
					}
				}
				
				// Test image tags
				assert.NotContains(t, container.Image, ":latest", 
					fmt.Sprintf("Container %s should not use latest tag", container.Name))
				
				// Test resource limits
				assert.NotNil(t, container.Resources.Limits, 
					fmt.Sprintf("Container %s should have resource limits", container.Name))
				assert.NotNil(t, container.Resources.Requests, 
					fmt.Sprintf("Container %s should have resource requests", container.Name))
			}
		}
	})

	suite.Logger.Info().Msg("Deployment tests completed")
}

// TestServices tests service infrastructure
func (suite *K8sTestSuite) TestServices(t *testing.T) {
	suite.Logger.Info().Msg("Testing services")

	// Test service health
	t.Run("Service Health", func(t *testing.T) {
		services, err := suite.Clientset.CoreV1().Services("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, service := range services.Items {
			// Test service type
			assert.Contains(t, []corev1.ServiceType{
				corev1.ServiceTypeClusterIP,
				corev1.ServiceTypeNodePort,
				corev1.ServiceTypeLoadBalancer,
				corev1.ServiceTypeExternalName,
			}, service.Spec.Type, fmt.Sprintf("Service %s should have valid type", service.Name))
			
			// Test service ports
			assert.True(t, len(service.Spec.Ports) > 0, 
				fmt.Sprintf("Service %s should have ports", service.Name))
			
			for _, port := range service.Spec.Ports {
				assert.True(t, port.Port > 0, 
					fmt.Sprintf("Service %s port should be positive", service.Name))
			}
			
			// Test endpoints
			endpoints, err := suite.Clientset.CoreV1().Endpoints(service.Namespace).Get(suite.Context, service.Name, metav1.GetOptions{})
			if err == nil {
				hasEndpoints := false
				for _, subset := range endpoints.Subsets {
					if len(subset.Addresses) > 0 {
						hasEndpoints = true
						break
					}
				}
				if service.Spec.Type != corev1.ServiceTypeExternalName {
					assert.True(t, hasEndpoints, 
						fmt.Sprintf("Service %s should have endpoints", service.Name))
				}
			}
			
			suite.Logger.Info().Str("service", service.Name).
				Str("namespace", service.Namespace).
				Str("type", string(service.Spec.Type)).
				Str("cluster_ip", service.Spec.ClusterIP).
				Interface("ports", service.Spec.Ports).
				Msg("Service information")
		}
	})

	suite.Logger.Info().Msg("Service tests completed")
}

// TestIngresses tests ingress infrastructure
func (suite *K8sTestSuite) TestIngresses(t *testing.T) {
	suite.Logger.Info().Msg("Testing ingresses")

	// Test ingress health
	t.Run("Ingress Health", func(t *testing.T) {
		ingresses, err := suite.Clientset.NetworkingV1().Ingresses("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, ingress := range ingresses.Items {
			// Test ingress class
			if ingress.Spec.IngressClassName != nil {
				assert.NotEmpty(t, *ingress.Spec.IngressClassName, 
					fmt.Sprintf("Ingress %s should have ingress class", ingress.Name))
			}
			
			// Test ingress rules
			assert.True(t, len(ingress.Spec.Rules) > 0, 
				fmt.Sprintf("Ingress %s should have rules", ingress.Name))
			
			for _, rule := range ingress.Spec.Rules {
				if rule.HTTP != nil {
					assert.True(t, len(rule.HTTP.Paths) > 0, 
						fmt.Sprintf("Ingress %s rule should have paths", ingress.Name))
				}
			}
			
			// Test TLS configuration
			for _, tls := range ingress.Spec.TLS {
				assert.True(t, len(tls.Hosts) > 0, 
					fmt.Sprintf("Ingress %s TLS should have hosts", ingress.Name))
				assert.NotEmpty(t, tls.SecretName, 
					fmt.Sprintf("Ingress %s TLS should have secret", ingress.Name))
			}
			
			suite.Logger.Info().Str("ingress", ingress.Name).
				Str("namespace", ingress.Namespace).
				Interface("rules", ingress.Spec.Rules).
				Interface("tls", ingress.Spec.TLS).
				Msg("Ingress information")
		}
	})

	suite.Logger.Info().Msg("Ingress tests completed")
}

// TestConfigMaps tests ConfigMap infrastructure
func (suite *K8sTestSuite) TestConfigMaps(t *testing.T) {
	suite.Logger.Info().Msg("Testing ConfigMaps")

	// Test ConfigMap health
	t.Run("ConfigMap Health", func(t *testing.T) {
		configMaps, err := suite.Clientset.CoreV1().ConfigMaps("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, cm := range configMaps.Items {
			// Test ConfigMap data
			dataCount := len(cm.Data) + len(cm.BinaryData)
			if dataCount == 0 {
				suite.Logger.Warn().Str("configmap", cm.Name).
					Str("namespace", cm.Namespace).
					Msg("ConfigMap has no data")
			}
			
			suite.Logger.Info().Str("configmap", cm.Name).
				Str("namespace", cm.Namespace).
				Int("data_keys", len(cm.Data)).
				Int("binary_data_keys", len(cm.BinaryData)).
				Msg("ConfigMap information")
		}
	})

	suite.Logger.Info().Msg("ConfigMap tests completed")
}

// TestSecrets tests Secret infrastructure
func (suite *K8sTestSuite) TestSecrets(t *testing.T) {
	suite.Logger.Info().Msg("Testing Secrets")

	// Test Secret health
	t.Run("Secret Health", func(t *testing.T) {
		secrets, err := suite.Clientset.CoreV1().Secrets("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, secret := range secrets.Items {
			// Test Secret type
			assert.NotEmpty(t, secret.Type, 
				fmt.Sprintf("Secret %s should have a type", secret.Name))
			
			// Test Secret data
			dataCount := len(secret.Data) + len(secret.StringData)
			if dataCount == 0 {
				suite.Logger.Warn().Str("secret", secret.Name).
					Str("namespace", secret.Namespace).
					Msg("Secret has no data")
			}
			
			// Check for sensitive data patterns
			for key := range secret.Data {
				if strings.Contains(strings.ToLower(key), "password") ||
				   strings.Contains(strings.ToLower(key), "token") ||
				   strings.Contains(strings.ToLower(key), "key") {
					suite.Logger.Info().Str("secret", secret.Name).
						Str("key", key).
						Msg("Found sensitive data in secret")
				}
			}
			
			suite.Logger.Info().Str("secret", secret.Name).
				Str("namespace", secret.Namespace).
				Str("type", string(secret.Type)).
				Int("data_keys", len(secret.Data)).
				Msg("Secret information")
		}
	})

	suite.Logger.Info().Msg("Secret tests completed")
}

// TestPersistentVolumes tests Persistent Volume infrastructure
func (suite *K8sTestSuite) TestPersistentVolumes(t *testing.T) {
	suite.Logger.Info().Msg("Testing Persistent Volumes")

	// Test Persistent Volumes
	t.Run("Persistent Volumes", func(t *testing.T) {
		pvs, err := suite.Clientset.CoreV1().PersistentVolumes().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, pv := range pvs.Items {
			// Test PV phase
			assert.Contains(t, []corev1.PersistentVolumePhase{
				corev1.VolumeAvailable,
				corev1.VolumeBound,
				corev1.VolumeReleased,
				corev1.VolumeFailed,
			}, pv.Status.Phase, fmt.Sprintf("PV %s should have valid phase", pv.Name))
			
			// Test PV capacity
			assert.NotNil(t, pv.Spec.Capacity, 
				fmt.Sprintf("PV %s should have capacity", pv.Name))
			
			// Test access modes
			assert.True(t, len(pv.Spec.AccessModes) > 0, 
				fmt.Sprintf("PV %s should have access modes", pv.Name))
			
			suite.Logger.Info().Str("pv", pv.Name).
				Str("phase", string(pv.Status.Phase)).
				Interface("capacity", pv.Spec.Capacity).
				Interface("access_modes", pv.Spec.AccessModes).
				Str("reclaim_policy", string(pv.Spec.PersistentVolumeReclaimPolicy)).
				Msg("Persistent Volume information")
		}
	})

	// Test Persistent Volume Claims
	t.Run("Persistent Volume Claims", func(t *testing.T) {
		pvcs, err := suite.Clientset.CoreV1().PersistentVolumeClaims("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, pvc := range pvcs.Items {
			// Test PVC phase
			assert.Contains(t, []corev1.PersistentVolumeClaimPhase{
				corev1.ClaimPending,
				corev1.ClaimBound,
				corev1.ClaimLost,
			}, pvc.Status.Phase, fmt.Sprintf("PVC %s should have valid phase", pvc.Name))
			
			// Test PVC resources
			assert.NotNil(t, pvc.Spec.Resources, 
				fmt.Sprintf("PVC %s should have resources", pvc.Name))
			
			suite.Logger.Info().Str("pvc", pvc.Name).
				Str("namespace", pvc.Namespace).
				Str("phase", string(pvc.Status.Phase)).
				Str("volume_name", pvc.Spec.VolumeName).
				Interface("resources", pvc.Spec.Resources).
				Msg("Persistent Volume Claim information")
		}
	})

	suite.Logger.Info().Msg("Persistent Volume tests completed")
}

// TestJobs tests Job infrastructure
func (suite *K8sTestSuite) TestJobs(t *testing.T) {
	suite.Logger.Info().Msg("Testing Jobs")

	// Test Jobs
	t.Run("Jobs", func(t *testing.T) {
		jobs, err := suite.Clientset.BatchV1().Jobs("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, job := range jobs.Items {
			// Test job conditions
			for _, condition := range job.Status.Conditions {
				if condition.Type == batchv1.JobComplete {
					suite.Logger.Info().Str("job", job.Name).
						Str("namespace", job.Namespace).
						Bool("complete", condition.Status == corev1.ConditionTrue).
						Msg("Job completion status")
				}
				if condition.Type == batchv1.JobFailed {
					if condition.Status == corev1.ConditionTrue {
						suite.Logger.Warn().Str("job", job.Name).
							Str("namespace", job.Namespace).
							Str("reason", condition.Reason).
							Str("message", condition.Message).
							Msg("Job failed")
					}
				}
			}
			
			suite.Logger.Info().Str("job", job.Name).
				Str("namespace", job.Namespace).
				Int32("active", job.Status.Active).
				Int32("succeeded", job.Status.Succeeded).
				Int32("failed", job.Status.Failed).
				Msg("Job status")
		}
	})

	suite.Logger.Info().Msg("Job tests completed")
}

// TestCronJobs tests CronJob infrastructure
func (suite *K8sTestSuite) TestCronJobs(t *testing.T) {
	suite.Logger.Info().Msg("Testing CronJobs")

	// Test CronJobs
	t.Run("CronJobs", func(t *testing.T) {
		cronJobs, err := suite.Clientset.BatchV1().CronJobs("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, cronJob := range cronJobs.Items {
			// Test cron schedule
			assert.NotEmpty(t, cronJob.Spec.Schedule, 
				fmt.Sprintf("CronJob %s should have a schedule", cronJob.Name))
			
			// Test job template
			assert.NotNil(t, cronJob.Spec.JobTemplate, 
				fmt.Sprintf("CronJob %s should have a job template", cronJob.Name))
			
			suite.Logger.Info().Str("cronjob", cronJob.Name).
				Str("namespace", cronJob.Namespace).
				Str("schedule", cronJob.Spec.Schedule).
				Bool("suspend", cronJob.Spec.Suspend != nil && *cronJob.Spec.Suspend).
				Interface("last_schedule_time", cronJob.Status.LastScheduleTime).
				Msg("CronJob information")
		}
	})

	suite.Logger.Info().Msg("CronJob tests completed")
}

// TestHorizontalPodAutoscaler tests HPA infrastructure
func (suite *K8sTestSuite) TestHorizontalPodAutoscaler(t *testing.T) {
	suite.Logger.Info().Msg("Testing Horizontal Pod Autoscalers")

	// Test HPAs
	t.Run("HPAs", func(t *testing.T) {
		hpas, err := suite.Clientset.AutoscalingV2().HorizontalPodAutoscalers("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, hpa := range hpas.Items {
			// Test HPA target
			assert.NotNil(t, hpa.Spec.ScaleTargetRef, 
				fmt.Sprintf("HPA %s should have scale target", hpa.Name))
			
			// Test min/max replicas
			assert.True(t, hpa.Spec.MinReplicas != nil && *hpa.Spec.MinReplicas > 0, 
				fmt.Sprintf("HPA %s should have min replicas", hpa.Name))
			assert.True(t, hpa.Spec.MaxReplicas > 0, 
				fmt.Sprintf("HPA %s should have max replicas", hpa.Name))
			assert.True(t, hpa.Spec.MaxReplicas >= *hpa.Spec.MinReplicas, 
				fmt.Sprintf("HPA %s max replicas should be >= min replicas", hpa.Name))
			
			// Test metrics
			assert.True(t, len(hpa.Spec.Metrics) > 0, 
				fmt.Sprintf("HPA %s should have metrics", hpa.Name))
			
			suite.Logger.Info().Str("hpa", hpa.Name).
				Str("namespace", hpa.Namespace).
				Str("target", hpa.Spec.ScaleTargetRef.Name).
				Int32("min_replicas", *hpa.Spec.MinReplicas).
				Int32("max_replicas", hpa.Spec.MaxReplicas).
				Int32("current_replicas", hpa.Status.CurrentReplicas).
				Msg("HPA information")
		}
	})

	suite.Logger.Info().Msg("HPA tests completed")
}

// TestRBAC tests RBAC infrastructure
func (suite *K8sTestSuite) TestRBAC(t *testing.T) {
	suite.Logger.Info().Msg("Testing RBAC")

	// Test Service Accounts
	t.Run("Service Accounts", func(t *testing.T) {
		serviceAccounts, err := suite.Clientset.CoreV1().ServiceAccounts("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, sa := range serviceAccounts.Items {
			suite.Logger.Info().Str("service_account", sa.Name).
				Str("namespace", sa.Namespace).
				Int("secrets", len(sa.Secrets)).
				Bool("automount_token", sa.AutomountServiceAccountToken == nil || *sa.AutomountServiceAccountToken).
				Msg("Service Account information")
		}
	})

	// Test Roles
	t.Run("Roles", func(t *testing.T) {
		roles, err := suite.Clientset.RbacV1().Roles("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, role := range roles.Items {
			assert.True(t, len(role.Rules) > 0, 
				fmt.Sprintf("Role %s should have rules", role.Name))
			
			suite.Logger.Info().Str("role", role.Name).
				Str("namespace", role.Namespace).
				Int("rules", len(role.Rules)).
				Msg("Role information")
		}
	})

	// Test ClusterRoles
	t.Run("ClusterRoles", func(t *testing.T) {
		clusterRoles, err := suite.Clientset.RbacV1().ClusterRoles().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, clusterRole := range clusterRoles.Items {
			suite.Logger.Info().Str("cluster_role", clusterRole.Name).
				Int("rules", len(clusterRole.Rules)).
				Msg("ClusterRole information")
		}
	})

	// Test RoleBindings
	t.Run("RoleBindings", func(t *testing.T) {
		roleBindings, err := suite.Clientset.RbacV1().RoleBindings("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, rb := range roleBindings.Items {
			assert.NotEmpty(t, rb.RoleRef.Name, 
				fmt.Sprintf("RoleBinding %s should have role reference", rb.Name))
			assert.True(t, len(rb.Subjects) > 0, 
				fmt.Sprintf("RoleBinding %s should have subjects", rb.Name))
			
			suite.Logger.Info().Str("role_binding", rb.Name).
				Str("namespace", rb.Namespace).
				Str("role", rb.RoleRef.Name).
				Int("subjects", len(rb.Subjects)).
				Msg("RoleBinding information")
		}
	})

	// Test ClusterRoleBindings
	t.Run("ClusterRoleBindings", func(t *testing.T) {
		clusterRoleBindings, err := suite.Clientset.RbacV1().ClusterRoleBindings().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, crb := range clusterRoleBindings.Items {
			assert.NotEmpty(t, crb.RoleRef.Name, 
				fmt.Sprintf("ClusterRoleBinding %s should have role reference", crb.Name))
			
			suite.Logger.Info().Str("cluster_role_binding", crb.Name).
				Str("cluster_role", crb.RoleRef.Name).
				Int("subjects", len(crb.Subjects)).
				Msg("ClusterRoleBinding information")
		}
	})

	suite.Logger.Info().Msg("RBAC tests completed")
}

// TestNetworkPolicies tests Network Policy infrastructure
func (suite *K8sTestSuite) TestNetworkPolicies(t *testing.T) {
	suite.Logger.Info().Msg("Testing Network Policies")

	// Test Network Policies
	t.Run("Network Policies", func(t *testing.T) {
		networkPolicies, err := suite.Clientset.NetworkingV1().NetworkPolicies("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, np := range networkPolicies.Items {
			// Test pod selector
			assert.NotNil(t, np.Spec.PodSelector, 
				fmt.Sprintf("NetworkPolicy %s should have pod selector", np.Name))
			
			// Test policy types
			assert.True(t, len(np.Spec.PolicyTypes) > 0, 
				fmt.Sprintf("NetworkPolicy %s should have policy types", np.Name))
			
			suite.Logger.Info().Str("network_policy", np.Name).
				Str("namespace", np.Namespace).
				Interface("policy_types", np.Spec.PolicyTypes).
				Interface("pod_selector", np.Spec.PodSelector).
				Msg("NetworkPolicy information")
		}
	})

	suite.Logger.Info().Msg("Network Policy tests completed")
}

// TestPodSecurityPolicies tests Pod Security Policy infrastructure
func (suite *K8sTestSuite) TestPodSecurityPolicies(t *testing.T) {
	suite.Logger.Info().Msg("Testing Pod Security Policies")

	// Test Pod Security Policies
	t.Run("Pod Security Policies", func(t *testing.T) {
		psps, err := suite.Clientset.PolicyV1beta1().PodSecurityPolicies().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, psp := range psps.Items {
			// Test security settings
			suite.Logger.Info().Str("pod_security_policy", psp.Name).
				Bool("privileged", psp.Spec.Privileged).
				Bool("allow_privilege_escalation", psp.Spec.AllowPrivilegeEscalation != nil && *psp.Spec.AllowPrivilegeEscalation).
				Bool("read_only_root_filesystem", psp.Spec.ReadOnlyRootFilesystem).
				Interface("run_as_user", psp.Spec.RunAsUser).
				Interface("fs_group", psp.Spec.FSGroup).
				Msg("PodSecurityPolicy information")
		}
	})

	suite.Logger.Info().Msg("Pod Security Policy tests completed")
}

// TestResourceQuotas tests Resource Quota infrastructure
func (suite *K8sTestSuite) TestResourceQuotas(t *testing.T) {
	suite.Logger.Info().Msg("Testing Resource Quotas")

	// Test Resource Quotas
	t.Run("Resource Quotas", func(t *testing.T) {
		quotas, err := suite.Clientset.CoreV1().ResourceQuotas("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, quota := range quotas.Items {
			suite.Logger.Info().Str("resource_quota", quota.Name).
				Str("namespace", quota.Namespace).
				Interface("hard", quota.Status.Hard).
				Interface("used", quota.Status.Used).
				Msg("ResourceQuota information")
			
			// Check quota usage
			for resource, hard := range quota.Status.Hard {
				used := quota.Status.Used[resource]
				if hard.Value() > 0 && used.Value() > 0 {
					usagePercentage := float64(used.Value()) / float64(hard.Value())
					if usagePercentage > 0.8 {
						suite.Logger.Warn().Str("resource_quota", quota.Name).
							Str("resource", string(resource)).
							Float64("usage_percentage", usagePercentage).
							Msg("High resource quota usage")
					}
				}
			}
		}
	})

	suite.Logger.Info().Msg("Resource Quota tests completed")
}

// TestStorageClasses tests Storage Class infrastructure
func (suite *K8sTestSuite) TestStorageClasses(t *testing.T) {
	suite.Logger.Info().Msg("Testing Storage Classes")

	// Test Storage Classes
	t.Run("Storage Classes", func(t *testing.T) {
		storageClasses, err := suite.Clientset.StorageV1().StorageClasses().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		for _, sc := range storageClasses.Items {
			// Test provisioner
			assert.NotEmpty(t, sc.Provisioner, 
				fmt.Sprintf("StorageClass %s should have provisioner", sc.Name))
			
			suite.Logger.Info().Str("storage_class", sc.Name).
				Str("provisioner", sc.Provisioner).
				Interface("parameters", sc.Parameters).
				Str("reclaim_policy", string(*sc.ReclaimPolicy)).
				Str("volume_binding_mode", string(*sc.VolumeBindingMode)).
				Msg("StorageClass information")
		}
	})

	suite.Logger.Info().Msg("Storage Class tests completed")
}

// TestSecurity tests security infrastructure
func (suite *K8sTestSuite) TestSecurity(t *testing.T) {
	suite.Logger.Info().Msg("Testing security")

	// Test Pod Security Standards
	t.Run("Pod Security Standards", func(t *testing.T) {
		// This would test Pod Security Standards implementation
		suite.Logger.Info().Msg("Pod Security Standards tests would be implemented here")
	})

	// Test Image Security
	t.Run("Image Security", func(t *testing.T) {
		// This would test image vulnerability scanning
		suite.Logger.Info().Msg("Image security tests would be implemented here")
	})

	suite.Logger.Info().Msg("Security tests completed")
}

// TestPerformance tests performance infrastructure
func (suite *K8sTestSuite) TestPerformance(t *testing.T) {
	suite.Logger.Info().Msg("Testing performance")

	// Test Resource Usage
	t.Run("Resource Usage", func(t *testing.T) {
		if suite.MetricsClientset == nil {
			t.Skip("Metrics client not available")
			return
		}

		podMetrics, err := suite.MetricsClientset.MetricsV1beta1().PodMetricses("").List(suite.Context, metav1.ListOptions{})
		if err != nil {
			suite.Logger.Warn().Err(err).Msg("Failed to get pod metrics")
			return
		}

		for _, metric := range podMetrics.Items {
			for _, container := range metric.Containers {
				suite.Logger.Info().Str("pod", metric.Name).
					Str("namespace", metric.Namespace).
					Str("container", container.Name).
					Str("cpu", container.Usage.Cpu().String()).
					Str("memory", container.Usage.Memory().String()).
					Msg("Container metrics")
			}
		}
	})

	suite.Logger.Info().Msg("Performance tests completed")
}

// TestMonitoring tests monitoring infrastructure
func (suite *K8sTestSuite) TestMonitoring(t *testing.T) {
	suite.Logger.Info().Msg("Testing monitoring")

	// Test Events
	t.Run("Events", func(t *testing.T) {
		events, err := suite.Clientset.CoreV1().Events("").List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		warningCount := 0
		errorCount := 0
		
		for _, event := range events.Items {
			switch event.Type {
			case corev1.EventTypeWarning:
				warningCount++
				suite.Logger.Warn().Str("event", event.Name).
					Str("namespace", event.Namespace).
					Str("reason", event.Reason).
					Str("message", event.Message).
					Msg("Warning event")
			case corev1.EventTypeNormal:
				// Normal events are typically not logged unless debugging
			}
		}
		
		suite.Logger.Info().Int("warning_events", warningCount).
			Int("total_events", len(events.Items)).
			Msg("Event summary")
	})

	suite.Logger.Info().Msg("Monitoring tests completed")
}

// TestBackup tests backup infrastructure
func (suite *K8sTestSuite) TestBackup(t *testing.T) {
	suite.Logger.Info().Msg("Testing backup")

	// Test Backup Solutions
	t.Run("Backup Solutions", func(t *testing.T) {
		// This would test backup solutions like Velero
		suite.Logger.Info().Msg("Backup solution tests would be implemented here")
	})

	suite.Logger.Info().Msg("Backup tests completed")
}

// TestDisasterRecovery tests disaster recovery
func (suite *K8sTestSuite) TestDisasterRecovery(t *testing.T) {
	suite.Logger.Info().Msg("Testing disaster recovery")

	// Test Multi-Zone Deployment
	t.Run("Multi-Zone Deployment", func(t *testing.T) {
		nodes, err := suite.Clientset.CoreV1().Nodes().List(suite.Context, metav1.ListOptions{})
		require.NoError(t, err)

		zones := make(map[string]int)
		for _, node := range nodes.Items {
			zone := node.Labels["topology.kubernetes.io/zone"]
			if zone != "" {
				zones[zone]++
			}
		}
		
		suite.Logger.Info().Interface("zones", zones).
			Msg("Node distribution across zones")
		
		if len(zones) > 1 {
			suite.Logger.Info().Msg("Multi-zone deployment detected")
		}
	})

	suite.Logger.Info().Msg("Disaster recovery tests completed")
}

// TestCompliance tests compliance
func (suite *K8sTestSuite) TestCompliance(t *testing.T) {
	suite.Logger.Info().Msg("Testing compliance")

	// Test CIS Kubernetes Benchmark
	t.Run("CIS Kubernetes Benchmark", func(t *testing.T) {
		// This would test CIS Kubernetes Benchmark compliance
		suite.Logger.Info().Msg("CIS Kubernetes Benchmark tests would be implemented here")
	})

	// Test NSA/CISA Kubernetes Hardening Guide
	t.Run("NSA/CISA Kubernetes Hardening", func(t *testing.T) {
		// This would test NSA/CISA Kubernetes hardening compliance
		suite.Logger.Info().Msg("NSA/CISA Kubernetes hardening tests would be implemented here")
	})

	suite.Logger.Info().Msg("Compliance tests completed")
}

// TestChaosEngineering tests chaos engineering
func (suite *K8sTestSuite) TestChaosEngineering(t *testing.T) {
	suite.Logger.Info().Msg("Testing chaos engineering")

	// Test Chaos Engineering Tools
	t.Run("Chaos Engineering Tools", func(t *testing.T) {
		// This would test chaos engineering tools like Chaos Mesh or Litmus
		suite.Logger.Info().Msg("Chaos engineering tests would be implemented here")
	})

	suite.Logger.Info().Msg("Chaos engineering tests completed")
}

// Helper methods for creating test resources
func (suite *K8sTestSuite) CreateTestNamespace(name string) error {
	namespace := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
			Labels: map[string]string{
				"test-id": suite.TestID,
				"purpose": "testing",
			},
		},
	}
	
	_, err := suite.Clientset.CoreV1().Namespaces().Create(suite.Context, namespace, metav1.CreateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to create test namespace %s", name)
	}
	
	suite.TestNamespaces = append(suite.TestNamespaces, name)
	suite.Logger.Info().Str("namespace", name).Msg("Created test namespace")
	return nil
}

func (suite *K8sTestSuite) CreateTestDeployment(namespace, name string, replicas int32) error {
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"test-id": suite.TestID,
				"app":     name,
			},
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"app": name,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app": name,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  "app",
							Image: "nginx:1.20",
							Ports: []corev1.ContainerPort{
								{
									ContainerPort: 80,
								},
							},
							Resources: corev1.ResourceRequirements{
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    "100m",
									corev1.ResourceMemory: "128Mi",
								},
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    "50m",
									corev1.ResourceMemory: "64Mi",
								},
							},
							SecurityContext: &corev1.SecurityContext{
								RunAsNonRoot:             &[]bool{true}[0],
								ReadOnlyRootFilesystem:   &[]bool{true}[0],
								AllowPrivilegeEscalation: &[]bool{false}[0],
							},
						},
					},
				},
			},
		},
	}
	
	_, err := suite.Clientset.AppsV1().Deployments(namespace).Create(suite.Context, deployment, metav1.CreateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to create test deployment %s", name)
	}
	
	suite.TestDeployments = append(suite.TestDeployments, fmt.Sprintf("%s/%s", namespace, name))
	suite.Logger.Info().Str("deployment", name).Str("namespace", namespace).Msg("Created test deployment")
	return nil
}

func (suite *K8sTestSuite) CreateTestService(namespace, name string, port int32) error {
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"test-id": suite.TestID,
				"app":     name,
			},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{
				"app": name,
			},
			Ports: []corev1.ServicePort{
				{
					Port:       port,
					TargetPort: intstr.FromInt(80),
					Protocol:   corev1.ProtocolTCP,
				},
			},
			Type: corev1.ServiceTypeClusterIP,
		},
	}
	
	_, err := suite.Clientset.CoreV1().Services(namespace).Create(suite.Context, service, metav1.CreateOptions{})
	if err != nil {
		return errors.Wrapf(err, "failed to create test service %s", name)
	}
	
	suite.TestServices = append(suite.TestServices, fmt.Sprintf("%s/%s", namespace, name))
	suite.Logger.Info().Str("service", name).Str("namespace", namespace).Msg("Created test service")
	return nil
}

// Cleanup methods
func (suite *K8sTestSuite) Cleanup() {
	suite.Logger.Info().Msg("Starting cleanup of test resources")
	
	// Cleanup test resources in reverse order
	suite.cleanupTestResources()
	
	// Cleanup test namespaces
	for _, namespace := range suite.TestNamespaces {
		err := suite.Clientset.CoreV1().Namespaces().Delete(suite.Context, namespace, metav1.DeleteOptions{})
		if err != nil {
			suite.Logger.Warn().Err(err).Str("namespace", namespace).Msg("Failed to delete test namespace")
		} else {
			suite.Logger.Info().Str("namespace", namespace).Msg("Deleted test namespace")
		}
	}
	
	suite.Logger.Info().Msg("Cleanup completed")
}

func (suite *K8sTestSuite) cleanupTestResources() {
	// Cleanup deployments
	for _, deployment := range suite.TestDeployments {
		parts := strings.Split(deployment, "/")
		if len(parts) == 2 {
			namespace, name := parts[0], parts[1]
			err := suite.Clientset.AppsV1().Deployments(namespace).Delete(suite.Context, name, metav1.DeleteOptions{})
			if err != nil {
				suite.Logger.Warn().Err(err).Str("deployment", deployment).Msg("Failed to delete test deployment")
			}
		}
	}
	
	// Cleanup services
	for _, service := range suite.TestServices {
		parts := strings.Split(service, "/")
		if len(parts) == 2 {
			namespace, name := parts[0], parts[1]
			err := suite.Clientset.CoreV1().Services(namespace).Delete(suite.Context, name, metav1.DeleteOptions{})
			if err != nil {
				suite.Logger.Warn().Err(err).Str("service", service).Msg("Failed to delete test service")
			}
		}
	}
	
	// Continue with other resource types...
}

// LoadTestManifest loads a test manifest from file
func LoadTestManifest(manifestPath string) (*K8sTestManifest, error) {
	data, err := files.ReadFile(manifestPath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read manifest file")
	}
	
	var manifest K8sTestManifest
	if err := yaml.Unmarshal([]byte(data), &manifest); err != nil {
		return nil, errors.Wrap(err, "failed to parse manifest file")
	}
	
	return &manifest, nil
}

// ApplyTestManifest applies a test manifest
func (suite *K8sTestSuite) ApplyTestManifest(manifest *K8sTestManifest) error {
	suite.Logger.Info().Str("manifest", manifest.Name).Msg("Applying test manifest")
	
	for _, resource := range manifest.Resources {
		if err := suite.applyResource(resource); err != nil {
			return errors.Wrapf(err, "failed to apply resource %s", resource.Metadata.Name)
		}
	}
	
	return nil
}

func (suite *K8sTestSuite) applyResource(resource K8sResource) error {
	// This would implement resource application logic based on resource kind
	suite.Logger.Info().Str("resource", resource.Metadata.Name).
		Str("kind", resource.Kind).
		Msg("Applying resource")
	
	// Implementation would depend on resource type
	return nil
}

// RunTestManifest runs tests defined in a manifest
func (suite *K8sTestSuite) RunTestManifest(t *testing.T, manifest *K8sTestManifest) error {
	suite.Logger.Info().Str("manifest", manifest.Name).Msg("Running test manifest")
	
	for _, test := range manifest.Tests {
		t.Run(test.Name, func(t *testing.T) {
			err := suite.runResourceTest(test)
			if err != nil {
				t.Errorf("Test %s failed: %v", test.Name, err)
			}
		})
	}
	
	return nil
}

func (suite *K8sTestSuite) runResourceTest(test K8sResourceTest) error {
	// This would implement test execution logic
	suite.Logger.Info().Str("test", test.Name).
		Str("type", test.Type).
		Str("resource", test.Resource).
		Msg("Running resource test")
	
	// Implementation would depend on test type and conditions
	return nil
}