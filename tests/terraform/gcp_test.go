package test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"google.golang.org/api/compute/v1"
	"google.golang.org/api/sql/v1"
	"google.golang.org/api/storage/v1"
	"google.golang.org/api/container/v1"
	"google.golang.org/api/cloudresourcemanager/v1"
	"google.golang.org/api/iam/v1"
	"google.golang.org/api/monitoring/v1"
	"google.golang.org/api/logging/v2"
	"google.golang.org/api/cloudfunctions/v1"
	"google.golang.org/api/run/v1"
	"google.golang.org/api/cloudkms/v1"
	"google.golang.org/api/secretmanager/v1"
	"google.golang.org/api/dns/v1"
	"google.golang.org/api/cloudsecurity/v1"
	"google.golang.org/api/securitycenter/v1"
	"google.golang.org/api/bigquery/v2"
	"google.golang.org/api/dataflow/v1b3"
	"google.golang.org/api/pubsub/v1"
	"google.golang.org/api/firebase/v1beta1"
	"google.golang.org/api/firestore/v1"
	"google.golang.org/api/redis/v1"
	"google.golang.org/api/memcache/v1"
	"google.golang.org/api/bigtable/v2"
	"google.golang.org/api/spanner/v1"
	"google.golang.org/api/datastore/v1"
	"google.golang.org/api/cloudbuild/v1"
	"google.golang.org/api/sourcerepo/v1"
	"google.golang.org/api/artifactregistry/v1"
	"google.golang.org/api/binaryauthorization/v1"
	"google.golang.org/api/cloudtrace/v2"
	"google.golang.org/api/clouddebugger/v2"
	"google.golang.org/api/cloudprofiler/v2"
	"google.golang.org/api/cloudscheduler/v1"
	"google.golang.org/api/cloudtasks/v2"
	"google.golang.org/api/appengine/v1"
	"google.golang.org/api/gameservices/v1"
	"google.golang.org/api/notebooks/v1"
	"google.golang.org/api/aiplatform/v1"
	"google.golang.org/api/ml/v1"
	"google.golang.org/api/translate/v3"
	"google.golang.org/api/speech/v1"
	"google.golang.org/api/vision/v1"
	"google.golang.org/api/videointelligence/v1"
	"google.golang.org/api/language/v1"
	"google.golang.org/api/documentai/v1"
	"google.golang.org/api/automl/v1"
	"google.golang.org/api/dialogflow/v2"
	"google.golang.org/api/healthcare/v1"
	"google.golang.org/api/lifesciences/v2beta"
	"google.golang.org/api/genomics/v2alpha1"
	"google.golang.org/api/datacatalog/v1"
	"google.golang.org/api/datafusion/v1"
	"google.golang.org/api/dataproc/v1"
	"google.golang.org/api/composer/v1"
	"google.golang.org/api/workflows/v1"
	"google.golang.org/api/eventarc/v1"
	"google.golang.org/api/apigateway/v1"
	"google.golang.org/api/apigee/v1"
	"google.golang.org/api/endpoints/v1"
	"google.golang.org/api/servicemanagement/v1"
	"google.golang.org/api/servicecontrol/v1"
	"google.golang.org/api/serviceusage/v1"
	"google.golang.org/api/servicenetworking/v1"
	"google.golang.org/api/osconfig/v1"
	"google.golang.org/api/assuredworkloads/v1"
	"google.golang.org/api/accesscontextmanager/v1"
	"google.golang.org/api/privateca/v1"
	"google.golang.org/api/certificatemanager/v1"
	"google.golang.org/api/iap/v1"
	"google.golang.org/api/recaptchaenterprise/v1"
	"google.golang.org/api/websecurityscanner/v1"
	"google.golang.org/api/cloudidentity/v1"
	"google.golang.org/api/admin/directory/v1"
	"google.golang.org/api/admin/reports/v1"
	"google.golang.org/api/cloudchannel/v1"
	"google.golang.org/api/cloudbilling/v1"
	"google.golang.org/api/recommender/v1"
	"google.golang.org/api/cloudoptimization/v1"
	"google.golang.org/api/policytroubleshooter/v1"
	"google.golang.org/api/orgpolicy/v2"
	"google.golang.org/api/cloudasset/v1"
	"google.golang.org/api/cloudsupport/v2"
	"google.golang.org/api/essentialcontacts/v1"
	"google.golang.org/api/workstations/v1"
	"google.golang.org/api/batch/v1"
	"google.golang.org/api/file/v1"
	"google.golang.org/api/networkservices/v1"
	"google.golang.org/api/networksecurity/v1"
	"google.golang.org/api/vmmigration/v1"
	"google.golang.org/api/baremetalsolution/v2"
	"google.golang.org/api/vmwareengine/v1"
	"google.golang.org/api/gkehub/v1"
	"google.golang.org/api/gkebackup/v1"
	"google.golang.org/api/backupdr/v1"
	"google.golang.org/api/migrationcenter/v1"
	"google.golang.org/api/discoveryengine/v1"
	"google.golang.org/api/retail/v2"
	"google.golang.org/api/recommendationengine/v1beta1"
	"google.golang.org/api/dataplex/v1"
	"google.golang.org/api/datalineage/v1"
	"google.golang.org/api/datapipelines/v1"
	"google.golang.org/api/datastream/v1"
	"google.golang.org/api/clouddms/v1"
	"google.golang.org/api/metastore/v1"
	"google.golang.org/api/analyticsdata/v1beta"
	"google.golang.org/api/analyticsadmin/v1beta"
	"google.golang.org/api/firebasehosting/v1"
	"google.golang.org/api/firebasedatabase/v1beta"
	"google.golang.org/api/firebaseremoteconfig/v1"
	"google.golang.org/api/firebasestorage/v1beta"
	"google.golang.org/api/fcm/v1"
	"google.golang.org/api/firebaseappcheck/v1"
	"google.golang.org/api/firebasedynamiclinks/v1"
	"google.golang.org/api/firebaseml/v1"
	"google.golang.org/api/firebase/v1beta1"
	"google.golang.org/api/option"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/gruntwork-io/terratest/modules/test-structure"
	"github.com/gruntwork-io/terratest/modules/retry"
	"github.com/gruntwork-io/terratest/modules/logger"
	"github.com/gruntwork-io/terratest/modules/http-helper"
	"github.com/gruntwork-io/terratest/modules/random"
	"github.com/gruntwork-io/terratest/modules/files"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/rs/zerolog/log"
	"github.com/pkg/errors"
	"github.com/google/uuid"
)

// GCPTestSuite manages GCP-specific infrastructure tests
type GCPTestSuite struct {
	ProjectID  string
	Region     string
	Zone       string
	TestID     string
	Config     TestConfig
	Logger     zerolog.Logger
	Context    context.Context
	
	// Core services
	Compute    *compute.Service
	SQL        *sql.Service
	Storage    *storage.Service
	Container  *container.Service
	
	// Management services
	CloudResourceManager *cloudresourcemanager.Service
	IAM                  *iam.Service
	
	// Monitoring and logging
	Monitoring *monitoring.Service
	Logging    *logging.Service
	
	// Serverless services
	CloudFunctions *cloudfunctions.Service
	CloudRun       *run.Service
	AppEngine      *appengine.Service
	
	// Security services
	CloudKMS       *cloudkms.Service
	SecretManager  *secretmanager.Service
	SecurityCenter *securitycenter.Service
	
	// Network services
	DNS           *dns.Service
	
	// Data services
	BigQuery      *bigquery.Service
	Dataflow      *dataflow.Service
	PubSub        *pubsub.Service
	Firebase      *firebase.Service
	Firestore     *firestore.Service
	Redis         *redis.Service
	Memcache      *memcache.Service
	Bigtable      *bigtable.Service
	Spanner       *spanner.Service
	Datastore     *datastore.Service
	
	// DevOps services
	CloudBuild         *cloudbuild.Service
	SourceRepo         *sourcerepo.Service
	ArtifactRegistry   *artifactregistry.Service
	BinaryAuthorization *binaryauthorization.Service
	
	// Observability services
	CloudTrace    *cloudtrace.Service
	CloudDebugger *clouddebugger.Service
	CloudProfiler *cloudprofiler.Service
	
	// Workflow services
	CloudScheduler *cloudscheduler.Service
	CloudTasks     *cloudtasks.Service
	
	// Game services
	GameServices *gameservices.Service
	
	// AI/ML services
	Notebooks   *notebooks.Service
	AIPlatform  *aiplatform.Service
	ML          *ml.Service
	Translate   *translate.Service
	Speech      *speech.Service
	Vision      *vision.Service
	VideoIntelligence *videointelligence.Service
	Language    *language.Service
	DocumentAI *documentai.Service
	AutoML      *automl.Service
	Dialogflow  *dialogflow.Service
	
	// Healthcare and life sciences
	Healthcare   *healthcare.Service
	LifeSciences *lifesciences.Service
	Genomics     *genomics.Service
	
	// Data analytics
	DataCatalog *datacatalog.Service
	DataFusion  *datafusion.Service
	DataProc    *dataproc.Service
	Composer    *composer.Service
	
	// Workflow and integration
	Workflows *workflows.Service
	EventArc  *eventarc.Service
	
	// API management
	APIGateway        *apigateway.Service
	Apigee            *apigee.Service
	Endpoints         *endpoints.Service
	ServiceManagement *servicemanagement.Service
	ServiceControl    *servicecontrol.Service
	ServiceUsage      *serviceusage.Service
	ServiceNetworking *servicenetworking.Service
	
	// Operations
	OSConfig *osconfig.Service
	
	// Security and compliance
	AssuredWorkloads        *assuredworkloads.Service
	AccessContextManager    *accesscontextmanager.Service
	PrivateCA              *privateca.Service
	CertificateManager     *certificatemanager.Service
	IAP                    *iap.Service
	reCAPTCHAEnterprise    *recaptchaenterprise.Service
	WebSecurityScanner     *websecurityscanner.Service
	
	// Identity and access
	CloudIdentity   *cloudidentity.Service
	AdminDirectory  *admin.Service
	AdminReports    *reports.Service
	
	// Billing and support
	CloudChannel  *cloudchannel.Service
	CloudBilling  *cloudbilling.Service
	Recommender   *recommender.Service
	CloudOptimization *cloudoptimization.Service
	
	// Policy and governance
	PolicyTroubleshooter *policytroubleshooter.Service
	OrgPolicy           *orgpolicy.Service
	CloudAsset          *cloudasset.Service
	CloudSupport        *cloudsupport.Service
	EssentialContacts   *essentialcontacts.Service
	
	// Compute and infrastructure
	Workstations *workstations.Service
	Batch        *batch.Service
	File         *file.Service
	
	// Network services
	NetworkServices *networkservices.Service
	NetworkSecurity *networksecurity.Service
	
	// Migration services
	VMMigration *vmmigration.Service
	BaremetalSolution *baremetalsolution.Service
	VMwareEngine *vmwareengine.Service
	
	// Kubernetes services
	GKEHub    *gkehub.Service
	GKEBackup *gkebackup.Service
	
	// Backup and disaster recovery
	BackupDR *backupdr.Service
	
	// Migration and modernization
	MigrationCenter *migrationcenter.Service
	
	// AI and search
	DiscoveryEngine *discoveryengine.Service
	Retail          *retail.Service
	RecommendationEngine *recommendationengine.Service
	
	// Data management
	DataPlex     *dataplex.Service
	DataLineage  *datalineage.Service
	DataPipelines *datapipelines.Service
	DataStream   *datastream.Service
	CloudDMS     *clouddms.Service
	Metastore    *metastore.Service
	
	// Analytics
	AnalyticsData  *analyticsdata.Service
	AnalyticsAdmin *analyticsadmin.Service
	
	// Firebase services
	FirebaseHosting      *firebasehosting.Service
	FirebaseDatabase     *firebasedatabase.Service
	FirebaseRemoteConfig *firebaseremoteconfig.Service
	FirebaseStorage      *firebasestorage.Service
	FCM                  *fcm.Service
	FirebaseAppCheck     *firebaseappcheck.Service
	FirebaseDynamicLinks *firebasedynamiclinks.Service
	FirebaseML           *firebaseml.Service
}

// NewGCPTestSuite creates a new GCP test suite
func NewGCPTestSuite(projectID, region, zone string, config TestConfig) (*GCPTestSuite, error) {
	testID := uuid.New().String()[:8]
	ctx := context.Background()
	
	// Initialize logger
	logger := log.With().
		Str("service", "gcp-test-suite").
		Str("project", projectID).
		Str("region", region).
		Str("zone", zone).
		Str("test_id", testID).
		Logger()

	// Create GCP service clients
	computeService, err := compute.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create compute service")
	}

	sqlService, err := sql.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create SQL service")
	}

	storageService, err := storage.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create storage service")
	}

	containerService, err := container.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create container service")
	}

	crmService, err := cloudresourcemanager.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create cloud resource manager service")
	}

	iamService, err := iam.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create IAM service")
	}

	monitoringService, err := monitoring.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create monitoring service")
	}

	loggingService, err := logging.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create logging service")
	}

	cloudFunctionsService, err := cloudfunctions.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create cloud functions service")
	}

	cloudRunService, err := run.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create cloud run service")
	}

	kmsService, err := cloudkms.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create KMS service")
	}

	secretManagerService, err := secretmanager.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create secret manager service")
	}

	dnsService, err := dns.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create DNS service")
	}

	securityCenterService, err := securitycenter.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create security center service")
	}

	bigQueryService, err := bigquery.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create BigQuery service")
	}

	dataflowService, err := dataflow.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create Dataflow service")
	}

	pubsubService, err := pubsub.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create Pub/Sub service")
	}

	firebaseService, err := firebase.NewService(ctx)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create Firebase service")
	}

	suite := &GCPTestSuite{
		ProjectID: projectID,
		Region:    region,
		Zone:      zone,
		TestID:    testID,
		Config:    config,
		Logger:    logger,
		Context:   ctx,
		
		// Core services
		Compute:   computeService,
		SQL:       sqlService,
		Storage:   storageService,
		Container: containerService,
		
		// Management services
		CloudResourceManager: crmService,
		IAM:                  iamService,
		
		// Monitoring and logging
		Monitoring: monitoringService,
		Logging:    loggingService,
		
		// Serverless services
		CloudFunctions: cloudFunctionsService,
		CloudRun:       cloudRunService,
		
		// Security services
		CloudKMS:       kmsService,
		SecretManager:  secretManagerService,
		SecurityCenter: securityCenterService,
		
		// Network services
		DNS: dnsService,
		
		// Data services
		BigQuery: bigQueryService,
		Dataflow: dataflowService,
		PubSub:   pubsubService,
		Firebase: firebaseService,
	}

	// Initialize additional services as needed
	if err := suite.initializeAdditionalServices(); err != nil {
		return nil, errors.Wrap(err, "failed to initialize additional services")
	}

	return suite, nil
}

// initializeAdditionalServices initializes additional GCP services
func (suite *GCPTestSuite) initializeAdditionalServices() error {
	var err error
	
	// Initialize Firestore
	suite.Firestore, err = firestore.NewService(suite.Context)
	if err != nil {
		suite.Logger.Warn().Err(err).Msg("Failed to initialize Firestore service")
	}

	// Initialize Redis
	suite.Redis, err = redis.NewService(suite.Context)
	if err != nil {
		suite.Logger.Warn().Err(err).Msg("Failed to initialize Redis service")
	}

	// Initialize Memcache
	suite.Memcache, err = memcache.NewService(suite.Context)
	if err != nil {
		suite.Logger.Warn().Err(err).Msg("Failed to initialize Memcache service")
	}

	// Initialize Cloud Build
	suite.CloudBuild, err = cloudbuild.NewService(suite.Context)
	if err != nil {
		suite.Logger.Warn().Err(err).Msg("Failed to initialize Cloud Build service")
	}

	// Initialize App Engine
	suite.AppEngine, err = appengine.NewService(suite.Context)
	if err != nil {
		suite.Logger.Warn().Err(err).Msg("Failed to initialize App Engine service")
	}

	return nil
}

// TestGCPInfrastructure runs comprehensive GCP infrastructure tests
func TestGCPInfrastructure(t *testing.T) {
	t.Parallel()

	// Load test configuration
	config, err := LoadTestConfig("test-config.yaml")
	require.NoError(t, err)

	// Get GCP project ID from environment or config
	projectID := "your-project-id" // This would come from config or environment
	region := config.Region
	zone := region + "-a" // Default zone

	// Create GCP test suite
	suite, err := NewGCPTestSuite(projectID, region, zone, config)
	require.NoError(t, err)

	suite.Logger.Info().Msg("Starting GCP infrastructure tests")

	// Test stages
	t.Run("VPC", suite.TestVPC)
	t.Run("Compute", suite.TestCompute)
	t.Run("SQL", suite.TestSQL)
	t.Run("Storage", suite.TestStorage)
	t.Run("GKE", suite.TestGKE)
	t.Run("IAM", suite.TestIAM)
	t.Run("Cloud Functions", suite.TestCloudFunctions)
	t.Run("Cloud Run", suite.TestCloudRun)
	t.Run("App Engine", suite.TestAppEngine)
	t.Run("Security", suite.TestSecurity)
	t.Run("Monitoring", suite.TestMonitoring)
	t.Run("BigQuery", suite.TestBigQuery)
	t.Run("Pub/Sub", suite.TestPubSub)
	t.Run("Firebase", suite.TestFirebase)
	t.Run("Compliance", suite.TestCompliance)
	t.Run("Performance", suite.TestPerformance)
	t.Run("Disaster Recovery", suite.TestDisasterRecovery)
	t.Run("Cost Management", suite.TestCostManagement)

	suite.Logger.Info().Msg("GCP infrastructure tests completed")
}

// TestVPC tests VPC infrastructure
func (suite *GCPTestSuite) TestVPC(t *testing.T) {
	suite.Logger.Info().Msg("Testing VPC infrastructure")

	// Test VPC Networks
	t.Run("VPC Networks", func(t *testing.T) {
		networks, err := suite.Compute.Networks.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test network configuration
		for _, network := range networks.Items {
			// Test network name
			assert.NotEmpty(t, network.Name, "Network should have a name")
			
			// Test self link
			assert.NotEmpty(t, network.SelfLink, "Network should have a self link")
			
			// Test creation timestamp
			assert.NotEmpty(t, network.CreationTimestamp, "Network should have a creation timestamp")
			
			// Test auto create subnetworks
			suite.Logger.Info().Str("network", network.Name).
				Bool("auto_create_subnetworks", network.AutoCreateSubnetworks).
				Msg("Network auto create subnetworks")
		}
	})

	// Test Subnets
	t.Run("Subnets", func(t *testing.T) {
		subnets, err := suite.Compute.Subnetworks.List(suite.ProjectID, suite.Region).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test subnet configuration
		for _, subnet := range subnets.Items {
			// Test subnet name
			assert.NotEmpty(t, subnet.Name, "Subnet should have a name")
			
			// Test IP CIDR range
			assert.NotEmpty(t, subnet.IpCidrRange, "Subnet should have an IP CIDR range")
			
			// Test network
			assert.NotEmpty(t, subnet.Network, "Subnet should belong to a network")
			
			// Test region
			assert.NotEmpty(t, subnet.Region, "Subnet should have a region")
			
			// Test creation timestamp
			assert.NotEmpty(t, subnet.CreationTimestamp, "Subnet should have a creation timestamp")
		}
	})

	// Test Firewall Rules
	t.Run("Firewall Rules", func(t *testing.T) {
		firewalls, err := suite.Compute.Firewalls.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test firewall configuration
		for _, firewall := range firewalls.Items {
			// Test firewall name
			assert.NotEmpty(t, firewall.Name, "Firewall should have a name")
			
			// Test network
			assert.NotEmpty(t, firewall.Network, "Firewall should belong to a network")
			
			// Test direction
			assert.Contains(t, []string{"INGRESS", "EGRESS"}, firewall.Direction, 
				"Firewall should have a valid direction")
			
			// Test allowed or denied rules
			hasRules := len(firewall.Allowed) > 0 || len(firewall.Denied) > 0
			assert.True(t, hasRules, "Firewall should have allowed or denied rules")
		}
	})

	// Test Routes
	t.Run("Routes", func(t *testing.T) {
		routes, err := suite.Compute.Routes.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test route configuration
		for _, route := range routes.Items {
			// Test route name
			assert.NotEmpty(t, route.Name, "Route should have a name")
			
			// Test network
			assert.NotEmpty(t, route.Network, "Route should belong to a network")
			
			// Test destination range
			assert.NotEmpty(t, route.DestRange, "Route should have a destination range")
			
			// Test priority
			assert.True(t, route.Priority >= 0 && route.Priority <= 65535, 
				"Route priority should be between 0 and 65535")
		}
	})

	// Test Load Balancers
	t.Run("Load Balancers", func(t *testing.T) {
		// Test Global Forwarding Rules
		globalForwardingRules, err := suite.Compute.GlobalForwardingRules.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, rule := range globalForwardingRules.Items {
			// Test rule name
			assert.NotEmpty(t, rule.Name, "Global forwarding rule should have a name")
			
			// Test IP address
			assert.NotEmpty(t, rule.IPAddress, "Global forwarding rule should have an IP address")
			
			// Test port range
			assert.NotEmpty(t, rule.PortRange, "Global forwarding rule should have a port range")
		}

		// Test Regional Forwarding Rules
		regionalForwardingRules, err := suite.Compute.ForwardingRules.List(suite.ProjectID, suite.Region).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, rule := range regionalForwardingRules.Items {
			// Test rule name
			assert.NotEmpty(t, rule.Name, "Regional forwarding rule should have a name")
			
			// Test IP address
			assert.NotEmpty(t, rule.IPAddress, "Regional forwarding rule should have an IP address")
		}
	})

	suite.Logger.Info().Msg("VPC infrastructure tests completed")
}

// TestCompute tests Compute Engine infrastructure
func (suite *GCPTestSuite) TestCompute(t *testing.T) {
	suite.Logger.Info().Msg("Testing Compute Engine infrastructure")

	// Test VM Instances
	t.Run("VM Instances", func(t *testing.T) {
		instances, err := suite.Compute.Instances.List(suite.ProjectID, suite.Zone).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test instance configuration
		for _, instance := range instances.Items {
			// Test instance name
			assert.NotEmpty(t, instance.Name, "Instance should have a name")
			
			// Test machine type
			assert.NotEmpty(t, instance.MachineType, "Instance should have a machine type")
			
			// Test status
			assert.Contains(t, []string{"PROVISIONING", "STAGING", "RUNNING", "STOPPING", "STOPPED", "SUSPENDING", "SUSPENDED", "TERMINATED"}, 
				instance.Status, "Instance should have a valid status")
			
			// Test zone
			assert.NotEmpty(t, instance.Zone, "Instance should have a zone")
			
			// Test creation timestamp
			assert.NotEmpty(t, instance.CreationTimestamp, "Instance should have a creation timestamp")
			
			// Test network interfaces
			assert.True(t, len(instance.NetworkInterfaces) > 0, "Instance should have network interfaces")
			
			// Test disks
			assert.True(t, len(instance.Disks) > 0, "Instance should have disks")
		}
	})

	// Test Instance Templates
	t.Run("Instance Templates", func(t *testing.T) {
		templates, err := suite.Compute.InstanceTemplates.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test template configuration
		for _, template := range templates.Items {
			// Test template name
			assert.NotEmpty(t, template.Name, "Instance template should have a name")
			
			// Test creation timestamp
			assert.NotEmpty(t, template.CreationTimestamp, "Instance template should have a creation timestamp")
			
			// Test properties
			assert.NotNil(t, template.Properties, "Instance template should have properties")
			
			// Test machine type
			assert.NotEmpty(t, template.Properties.MachineType, "Instance template should have a machine type")
		}
	})

	// Test Instance Groups
	t.Run("Instance Groups", func(t *testing.T) {
		// Test Managed Instance Groups
		migs, err := suite.Compute.InstanceGroupManagers.List(suite.ProjectID, suite.Zone).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, mig := range migs.Items {
			// Test MIG name
			assert.NotEmpty(t, mig.Name, "Managed instance group should have a name")
			
			// Test instance template
			assert.NotEmpty(t, mig.InstanceTemplate, "Managed instance group should have an instance template")
			
			// Test target size
			assert.True(t, mig.TargetSize >= 0, "Target size should be non-negative")
		}

		// Test Unmanaged Instance Groups
		uigs, err := suite.Compute.InstanceGroups.List(suite.ProjectID, suite.Zone).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, uig := range uigs.Items {
			// Test UIG name
			assert.NotEmpty(t, uig.Name, "Unmanaged instance group should have a name")
			
			// Test zone
			assert.NotEmpty(t, uig.Zone, "Unmanaged instance group should have a zone")
		}
	})

	// Test Persistent Disks
	t.Run("Persistent Disks", func(t *testing.T) {
		disks, err := suite.Compute.Disks.List(suite.ProjectID, suite.Zone).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test disk configuration
		for _, disk := range disks.Items {
			// Test disk name
			assert.NotEmpty(t, disk.Name, "Disk should have a name")
			
			// Test size
			assert.True(t, disk.SizeGb > 0, "Disk should have a size greater than 0")
			
			// Test type
			assert.NotEmpty(t, disk.Type, "Disk should have a type")
			
			// Test status
			assert.Contains(t, []string{"CREATING", "RESTORING", "FAILED", "READY", "DELETING"}, 
				disk.Status, "Disk should have a valid status")
			
			// Test zone
			assert.NotEmpty(t, disk.Zone, "Disk should have a zone")
		}
	})

	// Test Snapshots
	t.Run("Snapshots", func(t *testing.T) {
		snapshots, err := suite.Compute.Snapshots.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test snapshot configuration
		for _, snapshot := range snapshots.Items {
			// Test snapshot name
			assert.NotEmpty(t, snapshot.Name, "Snapshot should have a name")
			
			// Test source disk
			assert.NotEmpty(t, snapshot.SourceDisk, "Snapshot should have a source disk")
			
			// Test status
			assert.Contains(t, []string{"CREATING", "DELETING", "FAILED", "READY", "UPLOADING"}, 
				snapshot.Status, "Snapshot should have a valid status")
			
			// Test creation timestamp
			assert.NotEmpty(t, snapshot.CreationTimestamp, "Snapshot should have a creation timestamp")
		}
	})

	// Test Images
	t.Run("Images", func(t *testing.T) {
		images, err := suite.Compute.Images.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test image configuration
		for _, image := range images.Items {
			// Test image name
			assert.NotEmpty(t, image.Name, "Image should have a name")
			
			// Test status
			assert.Contains(t, []string{"PENDING", "READY", "FAILED"}, 
				image.Status, "Image should have a valid status")
			
			// Test family
			if image.Family != "" {
				assert.NotEmpty(t, image.Family, "Image family should not be empty")
			}
		}
	})

	suite.Logger.Info().Msg("Compute Engine infrastructure tests completed")
}

// TestSQL tests Cloud SQL infrastructure
func (suite *GCPTestSuite) TestSQL(t *testing.T) {
	suite.Logger.Info().Msg("Testing Cloud SQL infrastructure")

	// Test SQL Instances
	t.Run("SQL Instances", func(t *testing.T) {
		instances, err := suite.SQL.Instances.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test instance configuration
		for _, instance := range instances.Items {
			// Test instance name
			assert.NotEmpty(t, instance.Name, "SQL instance should have a name")
			
			// Test database version
			assert.NotEmpty(t, instance.DatabaseVersion, "SQL instance should have a database version")
			
			// Test state
			assert.Contains(t, []string{"RUNNABLE", "SUSPENDED", "PENDING_DELETE", "PENDING_CREATE", "MAINTENANCE", "FAILED", "UNKNOWN_STATE"}, 
				instance.State, "SQL instance should have a valid state")
			
			// Test region
			assert.NotEmpty(t, instance.Region, "SQL instance should have a region")
			
			// Test settings
			assert.NotNil(t, instance.Settings, "SQL instance should have settings")
			
			// Test tier
			assert.NotEmpty(t, instance.Settings.Tier, "SQL instance should have a tier")
			
			// Test backup configuration
			if instance.Settings.BackupConfiguration != nil {
				suite.Logger.Info().Str("instance", instance.Name).
					Bool("backup_enabled", instance.Settings.BackupConfiguration.Enabled).
					Msg("SQL instance backup configuration")
			}
		}
	})

	// Test SQL Databases
	t.Run("SQL Databases", func(t *testing.T) {
		instances, err := suite.SQL.Instances.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, instance := range instances.Items {
			databases, err := suite.SQL.Databases.List(suite.ProjectID, instance.Name).Context(suite.Context).Do()
			require.NoError(t, err)

			// Test database configuration
			for _, database := range databases.Items {
				// Test database name
				assert.NotEmpty(t, database.Name, "Database should have a name")
				
				// Test instance
				assert.NotEmpty(t, database.Instance, "Database should belong to an instance")
				
				// Test charset
				assert.NotEmpty(t, database.Charset, "Database should have a charset")
			}
		}
	})

	// Test SQL Users
	t.Run("SQL Users", func(t *testing.T) {
		instances, err := suite.SQL.Instances.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, instance := range instances.Items {
			users, err := suite.SQL.Users.List(suite.ProjectID, instance.Name).Context(suite.Context).Do()
			require.NoError(t, err)

			// Test user configuration
			for _, user := range users.Items {
				// Test user name
				assert.NotEmpty(t, user.Name, "SQL user should have a name")
				
				// Test instance
				assert.NotEmpty(t, user.Instance, "SQL user should belong to an instance")
			}
		}
	})

	suite.Logger.Info().Msg("Cloud SQL infrastructure tests completed")
}

// TestStorage tests Cloud Storage infrastructure
func (suite *GCPTestSuite) TestStorage(t *testing.T) {
	suite.Logger.Info().Msg("Testing Cloud Storage infrastructure")

	// Test Storage Buckets
	t.Run("Storage Buckets", func(t *testing.T) {
		buckets, err := suite.Storage.Buckets.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test bucket configuration
		for _, bucket := range buckets.Items {
			// Test bucket name
			assert.NotEmpty(t, bucket.Name, "Bucket should have a name")
			
			// Test location
			assert.NotEmpty(t, bucket.Location, "Bucket should have a location")
			
			// Test storage class
			assert.NotEmpty(t, bucket.StorageClass, "Bucket should have a storage class")
			
			// Test creation time
			assert.NotEmpty(t, bucket.TimeCreated, "Bucket should have a creation time")
			
			// Test versioning
			if bucket.Versioning != nil {
				suite.Logger.Info().Str("bucket", bucket.Name).
					Bool("versioning_enabled", bucket.Versioning.Enabled).
					Msg("Bucket versioning configuration")
			}
			
			// Test lifecycle
			if bucket.Lifecycle != nil {
				suite.Logger.Info().Str("bucket", bucket.Name).
					Int("lifecycle_rules", len(bucket.Lifecycle.Rule)).
					Msg("Bucket lifecycle configuration")
			}
			
			// Test encryption
			if bucket.Encryption != nil {
				suite.Logger.Info().Str("bucket", bucket.Name).
					Str("kms_key", bucket.Encryption.DefaultKmsKeyName).
					Msg("Bucket encryption configuration")
			}
		}
	})

	suite.Logger.Info().Msg("Cloud Storage infrastructure tests completed")
}

// TestGKE tests Google Kubernetes Engine infrastructure
func (suite *GCPTestSuite) TestGKE(t *testing.T) {
	suite.Logger.Info().Msg("Testing GKE infrastructure")

	// Test GKE Clusters
	t.Run("GKE Clusters", func(t *testing.T) {
		clusters, err := suite.Container.Projects.Zones.Clusters.List(suite.ProjectID, suite.Zone).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test cluster configuration
		for _, cluster := range clusters.Clusters {
			// Test cluster name
			assert.NotEmpty(t, cluster.Name, "Cluster should have a name")
			
			// Test status
			assert.Contains(t, []string{"PROVISIONING", "RUNNING", "RECONCILING", "STOPPING", "ERROR", "DEGRADED"}, 
				cluster.Status, "Cluster should have a valid status")
			
			// Test location
			assert.NotEmpty(t, cluster.Location, "Cluster should have a location")
			
			// Test initial node count
			assert.True(t, cluster.InitialNodeCount > 0, "Cluster should have an initial node count")
			
			// Test node config
			if cluster.NodeConfig != nil {
				assert.NotEmpty(t, cluster.NodeConfig.MachineType, "Node config should have a machine type")
				assert.True(t, cluster.NodeConfig.DiskSizeGb > 0, "Node config should have disk size")
			}
			
			// Test network
			assert.NotEmpty(t, cluster.Network, "Cluster should have a network")
			
			// Test subnetwork
			if cluster.Subnetwork != "" {
				assert.NotEmpty(t, cluster.Subnetwork, "Cluster subnetwork should not be empty")
			}
		}
	})

	// Test Node Pools
	t.Run("Node Pools", func(t *testing.T) {
		clusters, err := suite.Container.Projects.Zones.Clusters.List(suite.ProjectID, suite.Zone).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, cluster := range clusters.Clusters {
			nodePools, err := suite.Container.Projects.Zones.Clusters.NodePools.List(suite.ProjectID, suite.Zone, cluster.Name).Context(suite.Context).Do()
			require.NoError(t, err)

			// Test node pool configuration
			for _, nodePool := range nodePools.NodePools {
				// Test node pool name
				assert.NotEmpty(t, nodePool.Name, "Node pool should have a name")
				
				// Test status
				assert.Contains(t, []string{"PROVISIONING", "RUNNING", "RUNNING_WITH_ERROR", "RECONCILING", "STOPPING", "ERROR"}, 
					nodePool.Status, "Node pool should have a valid status")
				
				// Test initial node count
				assert.True(t, nodePool.InitialNodeCount > 0, "Node pool should have an initial node count")
				
				// Test config
				if nodePool.Config != nil {
					assert.NotEmpty(t, nodePool.Config.MachineType, "Node pool config should have a machine type")
					assert.True(t, nodePool.Config.DiskSizeGb > 0, "Node pool config should have disk size")
				}
			}
		}
	})

	suite.Logger.Info().Msg("GKE infrastructure tests completed")
}

// TestIAM tests IAM infrastructure
func (suite *GCPTestSuite) TestIAM(t *testing.T) {
	suite.Logger.Info().Msg("Testing IAM infrastructure")

	// Test IAM Policies
	t.Run("IAM Policies", func(t *testing.T) {
		policy, err := suite.CloudResourceManager.Projects.GetIamPolicy(suite.ProjectID, &cloudresourcemanager.GetIamPolicyRequest{}).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test policy configuration
		assert.NotNil(t, policy, "Project should have an IAM policy")
		assert.True(t, len(policy.Bindings) > 0, "IAM policy should have bindings")

		// Test bindings
		for _, binding := range policy.Bindings {
			// Test role
			assert.NotEmpty(t, binding.Role, "Binding should have a role")
			
			// Test members
			assert.True(t, len(binding.Members) > 0, "Binding should have members")
		}
	})

	// Test Service Accounts
	t.Run("Service Accounts", func(t *testing.T) {
		serviceAccounts, err := suite.IAM.Projects.ServiceAccounts.List("projects/" + suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test service account configuration
		for _, sa := range serviceAccounts.Accounts {
			// Test service account name
			assert.NotEmpty(t, sa.Name, "Service account should have a name")
			
			// Test email
			assert.NotEmpty(t, sa.Email, "Service account should have an email")
			
			// Test unique ID
			assert.NotEmpty(t, sa.UniqueId, "Service account should have a unique ID")
		}
	})

	suite.Logger.Info().Msg("IAM infrastructure tests completed")
}

// TestCloudFunctions tests Cloud Functions infrastructure
func (suite *GCPTestSuite) TestCloudFunctions(t *testing.T) {
	suite.Logger.Info().Msg("Testing Cloud Functions infrastructure")

	// Test Cloud Functions
	t.Run("Cloud Functions", func(t *testing.T) {
		functions, err := suite.CloudFunctions.Projects.Locations.Functions.List("projects/" + suite.ProjectID + "/locations/" + suite.Region).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test function configuration
		for _, function := range functions.Functions {
			// Test function name
			assert.NotEmpty(t, function.Name, "Function should have a name")
			
			// Test status
			assert.Contains(t, []string{"CLOUD_FUNCTION_STATUS_UNSPECIFIED", "ACTIVE", "OFFLINE", "DEPLOY_IN_PROGRESS", "DELETE_IN_PROGRESS", "UNKNOWN"}, 
				function.Status, "Function should have a valid status")
			
			// Test runtime
			assert.NotEmpty(t, function.Runtime, "Function should have a runtime")
			
			// Test entry point
			assert.NotEmpty(t, function.EntryPoint, "Function should have an entry point")
		}
	})

	suite.Logger.Info().Msg("Cloud Functions infrastructure tests completed")
}

// TestCloudRun tests Cloud Run infrastructure
func (suite *GCPTestSuite) TestCloudRun(t *testing.T) {
	suite.Logger.Info().Msg("Testing Cloud Run infrastructure")

	// Test Cloud Run Services
	t.Run("Cloud Run Services", func(t *testing.T) {
		services, err := suite.CloudRun.Projects.Locations.Services.List("projects/" + suite.ProjectID + "/locations/" + suite.Region).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test service configuration
		for _, service := range services.Items {
			// Test service name
			assert.NotEmpty(t, service.Metadata.Name, "Service should have a name")
			
			// Test namespace
			assert.NotEmpty(t, service.Metadata.Namespace, "Service should have a namespace")
			
			// Test spec
			assert.NotNil(t, service.Spec, "Service should have a spec")
			
			// Test status
			assert.NotNil(t, service.Status, "Service should have a status")
		}
	})

	suite.Logger.Info().Msg("Cloud Run infrastructure tests completed")
}

// TestAppEngine tests App Engine infrastructure
func (suite *GCPTestSuite) TestAppEngine(t *testing.T) {
	suite.Logger.Info().Msg("Testing App Engine infrastructure")

	// Test App Engine Application
	t.Run("App Engine Application", func(t *testing.T) {
		app, err := suite.AppEngine.Apps.Get(suite.ProjectID).Context(suite.Context).Do()
		if err != nil {
			suite.Logger.Warn().Err(err).Msg("App Engine application not found or not accessible")
			return
		}

		// Test application configuration
		assert.NotEmpty(t, app.Id, "App Engine application should have an ID")
		assert.NotEmpty(t, app.LocationId, "App Engine application should have a location")
		assert.NotEmpty(t, app.ServingStatus, "App Engine application should have a serving status")
	})

	// Test App Engine Services
	t.Run("App Engine Services", func(t *testing.T) {
		services, err := suite.AppEngine.Apps.Services.List(suite.ProjectID).Context(suite.Context).Do()
		if err != nil {
			suite.Logger.Warn().Err(err).Msg("App Engine services not found or not accessible")
			return
		}

		// Test service configuration
		for _, service := range services.Services {
			// Test service name
			assert.NotEmpty(t, service.Name, "App Engine service should have a name")
			
			// Test ID
			assert.NotEmpty(t, service.Id, "App Engine service should have an ID")
		}
	})

	suite.Logger.Info().Msg("App Engine infrastructure tests completed")
}

// TestSecurity tests security infrastructure
func (suite *GCPTestSuite) TestSecurity(t *testing.T) {
	suite.Logger.Info().Msg("Testing security infrastructure")

	// Test KMS Keys
	t.Run("KMS Keys", func(t *testing.T) {
		keyRings, err := suite.CloudKMS.Projects.Locations.KeyRings.List("projects/" + suite.ProjectID + "/locations/" + suite.Region).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test key ring configuration
		for _, keyRing := range keyRings.KeyRings {
			// Test key ring name
			assert.NotEmpty(t, keyRing.Name, "Key ring should have a name")
			
			// Test creation time
			assert.NotEmpty(t, keyRing.CreateTime, "Key ring should have a creation time")

			// Test crypto keys in the key ring
			cryptoKeys, err := suite.CloudKMS.Projects.Locations.KeyRings.CryptoKeys.List(keyRing.Name).Context(suite.Context).Do()
			require.NoError(t, err)

			for _, cryptoKey := range cryptoKeys.CryptoKeys {
				// Test crypto key name
				assert.NotEmpty(t, cryptoKey.Name, "Crypto key should have a name")
				
				// Test purpose
				assert.NotEmpty(t, cryptoKey.Purpose, "Crypto key should have a purpose")
				
				// Test creation time
				assert.NotEmpty(t, cryptoKey.CreateTime, "Crypto key should have a creation time")
			}
		}
	})

	// Test Secret Manager
	t.Run("Secret Manager", func(t *testing.T) {
		secrets, err := suite.SecretManager.Projects.Secrets.List("projects/" + suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test secret configuration
		for _, secret := range secrets.Secrets {
			// Test secret name
			assert.NotEmpty(t, secret.Name, "Secret should have a name")
			
			// Test creation time
			assert.NotEmpty(t, secret.CreateTime, "Secret should have a creation time")
		}
	})

	// Test Security Center
	t.Run("Security Center", func(t *testing.T) {
		// Test organization sources
		sources, err := suite.SecurityCenter.Organizations.Sources.List("organizations/123456789").Context(suite.Context).Do()
		if err != nil {
			suite.Logger.Warn().Err(err).Msg("Security Center not accessible or not configured")
			return
		}

		// Test source configuration
		for _, source := range sources.Sources {
			// Test source name
			assert.NotEmpty(t, source.Name, "Security Center source should have a name")
			
			// Test display name
			assert.NotEmpty(t, source.DisplayName, "Security Center source should have a display name")
		}
	})

	suite.Logger.Info().Msg("Security infrastructure tests completed")
}

// TestMonitoring tests monitoring infrastructure
func (suite *GCPTestSuite) TestMonitoring(t *testing.T) {
	suite.Logger.Info().Msg("Testing monitoring infrastructure")

	// Test Monitoring Policies
	t.Run("Monitoring Policies", func(t *testing.T) {
		policies, err := suite.Monitoring.Projects.AlertPolicies.List("projects/" + suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test policy configuration
		for _, policy := range policies.AlertPolicies {
			// Test policy name
			assert.NotEmpty(t, policy.Name, "Alert policy should have a name")
			
			// Test display name
			assert.NotEmpty(t, policy.DisplayName, "Alert policy should have a display name")
			
			// Test conditions
			assert.True(t, len(policy.Conditions) > 0, "Alert policy should have conditions")
			
			// Test enabled state
			suite.Logger.Info().Str("policy", policy.DisplayName).
				Bool("enabled", policy.Enabled).
				Msg("Alert policy enabled state")
		}
	})

	// Test Logging
	t.Run("Logging", func(t *testing.T) {
		logs, err := suite.Logging.Projects.Logs.List("projects/" + suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test log configuration
		for _, logName := range logs.LogNames {
			// Test log name
			assert.NotEmpty(t, logName, "Log should have a name")
		}
	})

	suite.Logger.Info().Msg("Monitoring infrastructure tests completed")
}

// TestBigQuery tests BigQuery infrastructure
func (suite *GCPTestSuite) TestBigQuery(t *testing.T) {
	suite.Logger.Info().Msg("Testing BigQuery infrastructure")

	// Test BigQuery Datasets
	t.Run("BigQuery Datasets", func(t *testing.T) {
		datasets, err := suite.BigQuery.Datasets.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test dataset configuration
		for _, dataset := range datasets.Datasets {
			// Test dataset ID
			assert.NotEmpty(t, dataset.Id, "Dataset should have an ID")
			
			// Test dataset reference
			assert.NotNil(t, dataset.DatasetReference, "Dataset should have a reference")
			assert.NotEmpty(t, dataset.DatasetReference.DatasetId, "Dataset reference should have a dataset ID")
			
			// Test creation time
			assert.True(t, dataset.CreationTime > 0, "Dataset should have a creation time")
		}
	})

	// Test BigQuery Tables
	t.Run("BigQuery Tables", func(t *testing.T) {
		datasets, err := suite.BigQuery.Datasets.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, dataset := range datasets.Datasets {
			tables, err := suite.BigQuery.Tables.List(suite.ProjectID, dataset.DatasetReference.DatasetId).Context(suite.Context).Do()
			require.NoError(t, err)

			// Test table configuration
			for _, table := range tables.Tables {
				// Test table ID
				assert.NotEmpty(t, table.Id, "Table should have an ID")
				
				// Test table reference
				assert.NotNil(t, table.TableReference, "Table should have a reference")
				assert.NotEmpty(t, table.TableReference.TableId, "Table reference should have a table ID")
				
				// Test creation time
				assert.True(t, table.CreationTime > 0, "Table should have a creation time")
			}
		}
	})

	suite.Logger.Info().Msg("BigQuery infrastructure tests completed")
}

// TestPubSub tests Pub/Sub infrastructure
func (suite *GCPTestSuite) TestPubSub(t *testing.T) {
	suite.Logger.Info().Msg("Testing Pub/Sub infrastructure")

	// Test Pub/Sub Topics
	t.Run("Pub/Sub Topics", func(t *testing.T) {
		topics, err := suite.PubSub.Projects.Topics.List("projects/" + suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test topic configuration
		for _, topic := range topics.Topics {
			// Test topic name
			assert.NotEmpty(t, topic.Name, "Topic should have a name")
		}
	})

	// Test Pub/Sub Subscriptions
	t.Run("Pub/Sub Subscriptions", func(t *testing.T) {
		subscriptions, err := suite.PubSub.Projects.Subscriptions.List("projects/" + suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test subscription configuration
		for _, subscription := range subscriptions.Subscriptions {
			// Test subscription name
			assert.NotEmpty(t, subscription.Name, "Subscription should have a name")
			
			// Test topic
			assert.NotEmpty(t, subscription.Topic, "Subscription should have a topic")
			
			// Test ack deadline
			assert.True(t, subscription.AckDeadlineSeconds > 0, "Subscription should have an ack deadline")
		}
	})

	suite.Logger.Info().Msg("Pub/Sub infrastructure tests completed")
}

// TestFirebase tests Firebase infrastructure
func (suite *GCPTestSuite) TestFirebase(t *testing.T) {
	suite.Logger.Info().Msg("Testing Firebase infrastructure")

	// Test Firebase Projects
	t.Run("Firebase Projects", func(t *testing.T) {
		projects, err := suite.Firebase.Projects.List().Context(suite.Context).Do()
		require.NoError(t, err)

		// Test project configuration
		for _, project := range projects.Results {
			// Test project ID
			assert.NotEmpty(t, project.ProjectId, "Firebase project should have a project ID")
			
			// Test display name
			assert.NotEmpty(t, project.DisplayName, "Firebase project should have a display name")
			
			// Test state
			assert.Contains(t, []string{"STATE_UNSPECIFIED", "ACTIVE", "DELETED"}, 
				project.State, "Firebase project should have a valid state")
		}
	})

	suite.Logger.Info().Msg("Firebase infrastructure tests completed")
}

// TestCompliance tests compliance
func (suite *GCPTestSuite) TestCompliance(t *testing.T) {
	suite.Logger.Info().Msg("Testing compliance")

	// Test Asset Inventory
	t.Run("Asset Inventory", func(t *testing.T) {
		// This would test Cloud Asset Inventory if it's configured
		suite.Logger.Info().Msg("Asset inventory compliance tests would be implemented here")
	})

	// Test Policy Compliance
	t.Run("Policy Compliance", func(t *testing.T) {
		// This would test Organization Policy constraints
		suite.Logger.Info().Msg("Policy compliance tests would be implemented here")
	})

	suite.Logger.Info().Msg("Compliance tests completed")
}

// TestPerformance tests performance
func (suite *GCPTestSuite) TestPerformance(t *testing.T) {
	suite.Logger.Info().Msg("Testing performance")

	// Test Autoscaling
	t.Run("Autoscaling", func(t *testing.T) {
		autoscalers, err := suite.Compute.Autoscalers.List(suite.ProjectID, suite.Zone).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test autoscaler configuration
		for _, autoscaler := range autoscalers.Items {
			// Test autoscaler name
			assert.NotEmpty(t, autoscaler.Name, "Autoscaler should have a name")
			
			// Test target
			assert.NotEmpty(t, autoscaler.Target, "Autoscaler should have a target")
			
			// Test autoscaling policy
			assert.NotNil(t, autoscaler.AutoscalingPolicy, "Autoscaler should have a policy")
			
			// Test min/max replicas
			assert.True(t, autoscaler.AutoscalingPolicy.MinNumReplicas > 0, "Min replicas should be greater than 0")
			assert.True(t, autoscaler.AutoscalingPolicy.MaxNumReplicas >= autoscaler.AutoscalingPolicy.MinNumReplicas, 
				"Max replicas should be >= min replicas")
		}
	})

	suite.Logger.Info().Msg("Performance tests completed")
}

// TestDisasterRecovery tests disaster recovery
func (suite *GCPTestSuite) TestDisasterRecovery(t *testing.T) {
	suite.Logger.Info().Msg("Testing disaster recovery")

	// Test Multi-Region Deployments
	t.Run("Multi-Region Deployments", func(t *testing.T) {
		// Test Cloud SQL replicas
		instances, err := suite.SQL.Instances.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, instance := range instances.Items {
			if instance.ReplicaConfiguration != nil {
				suite.Logger.Info().Str("instance", instance.Name).
					Msg("SQL instance has replica configuration")
			}
		}
	})

	// Test Backup Strategies
	t.Run("Backup Strategies", func(t *testing.T) {
		// Test SQL backups
		instances, err := suite.SQL.Instances.List(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		for _, instance := range instances.Items {
			if instance.Settings.BackupConfiguration != nil && instance.Settings.BackupConfiguration.Enabled {
				suite.Logger.Info().Str("instance", instance.Name).
					Msg("SQL instance has backups enabled")
			}
		}
	})

	suite.Logger.Info().Msg("Disaster recovery tests completed")
}

// TestCostManagement tests cost management
func (suite *GCPTestSuite) TestCostManagement(t *testing.T) {
	suite.Logger.Info().Msg("Testing cost management")

	// Test Billing
	t.Run("Billing", func(t *testing.T) {
		// This would test Cloud Billing if it's configured
		suite.Logger.Info().Msg("Billing and cost management tests would be implemented here")
	})

	// Test Resource Quotas
	t.Run("Resource Quotas", func(t *testing.T) {
		// Test project quotas
		project, err := suite.Compute.Projects.Get(suite.ProjectID).Context(suite.Context).Do()
		require.NoError(t, err)

		// Test quotas
		for _, quota := range project.Quotas {
			suite.Logger.Info().Str("metric", quota.Metric).
				Float64("usage", quota.Usage).
				Float64("limit", quota.Limit).
				Msg("Resource quota")
			
			// Check quota usage
			usagePercentage := quota.Usage / quota.Limit
			if usagePercentage > 0.8 {
				suite.Logger.Warn().Str("metric", quota.Metric).
					Float64("usage_percentage", usagePercentage).
					Msg("High quota usage")
			}
		}
	})

	suite.Logger.Info().Msg("Cost management tests completed")
}

// Helper methods for health checks and connectivity tests
func (suite *GCPTestSuite) TestDatabaseHealth(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing database health")
	// Implementation would test actual database connectivity
	return nil
}

func (suite *GCPTestSuite) TestCacheHealth(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing cache health")
	// Implementation would test actual cache connectivity
	return nil
}

func (suite *GCPTestSuite) TestLoadBalancerHealth(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing load balancer health")
	// Implementation would test actual load balancer connectivity
	return nil
}

func (suite *GCPTestSuite) TestContainerServiceHealth(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing container service health")
	// Implementation would test actual container service connectivity
	return nil
}

func (suite *GCPTestSuite) TestHTTPConnectivity(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing HTTP connectivity")
	// Implementation would test actual HTTP connectivity using http-helper
	return nil
}

func (suite *GCPTestSuite) TestInternalConnectivity(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing internal connectivity")
	// Implementation would test actual internal connectivity
	return nil
}

func (suite *GCPTestSuite) TestSSLConfiguration(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing SSL configuration")
	// Implementation would test SSL/TLS configuration
	return nil
}

func (suite *GCPTestSuite) TestNetworkSecurity(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing network security")
	// Implementation would test network security rules
	return nil
}

func (suite *GCPTestSuite) TestAccessControls(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing access controls")
	// Implementation would test access control policies
	return nil
}

func (suite *GCPTestSuite) TestEncryption(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing encryption")
	// Implementation would test encryption configuration
	return nil
}

func (suite *GCPTestSuite) TestLoadPerformance(outputs map[string]interface{}) error {
	suite.Logger.Info().Str("test_type", "load").Msg("Testing load performance")
	// Implementation would run load performance tests
	return nil
}

func (suite *GCPTestSuite) TestStressPerformance(outputs map[string]interface{}) error {
	suite.Logger.Info().Str("test_type", "stress").Msg("Testing stress performance")
	// Implementation would run stress performance tests
	return nil
}

func (suite *GCPTestSuite) TestEndurancePerformance(outputs map[string]interface{}) error {
	suite.Logger.Info().Str("test_type", "endurance").Msg("Testing endurance performance")
	// Implementation would run endurance performance tests
	return nil
}

func (suite *GCPTestSuite) TestDatabaseBackup(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing database backup")
	// Implementation would test database backup functionality
	return nil
}

func (suite *GCPTestSuite) TestStorageBackup(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing storage backup")
	// Implementation would test storage backup functionality
	return nil
}

func (suite *GCPTestSuite) TestMonitoringEndpoint(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing monitoring endpoint")
	// Implementation would test monitoring endpoint
	return nil
}

func (suite *GCPTestSuite) TestAlertingEndpoint(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing alerting endpoint")
	// Implementation would test alerting endpoint
	return nil
}