package test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/rds"
	"github.com/aws/aws-sdk-go/service/elasticache"
	"github.com/aws/aws-sdk-go/service/elbv2"
	"github.com/aws/aws-sdk-go/service/cloudformation"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/aws/aws-sdk-go/service/cloudwatchlogs"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/iam"
	"github.com/aws/aws-sdk-go/service/kms"
	"github.com/aws/aws-sdk-go/service/secretsmanager"
	"github.com/aws/aws-sdk-go/service/route53"
	"github.com/aws/aws-sdk-go/service/acm"
	"github.com/aws/aws-sdk-go/service/waf"
	"github.com/aws/aws-sdk-go/service/wafv2"
	"github.com/aws/aws-sdk-go/service/guardduty"
	"github.com/aws/aws-sdk-go/service/inspector"
	"github.com/aws/aws-sdk-go/service/config"
	"github.com/aws/aws-sdk-go/service/pricing"
	"github.com/aws/aws-sdk-go/service/costexplorer"
	"github.com/aws/aws-sdk-go/service/budgets"
	"github.com/aws/aws-sdk-go/service/organizations"
	"github.com/aws/aws-sdk-go/service/sts"
	"github.com/aws/aws-sdk-go/service/lambda"
	"github.com/aws/aws-sdk-go/service/apigateway"
	"github.com/aws/aws-sdk-go/service/cloudfront"
	"github.com/aws/aws-sdk-go/service/ecs"
	"github.com/aws/aws-sdk-go/service/eks"
	"github.com/aws/aws-sdk-go/service/autoscaling"
	"github.com/aws/aws-sdk-go/service/ssm"
	"github.com/aws/aws-sdk-go/service/sns"
	"github.com/aws/aws-sdk-go/service/sqs"
	"github.com/aws/aws-sdk-go/service/kinesis"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/elasticsearch"
	"github.com/aws/aws-sdk-go/service/backup"
	"github.com/aws/aws-sdk-go/service/datasync"
	"github.com/aws/aws-sdk-go/service/storagegateway"
	"github.com/aws/aws-sdk-go/service/directconnect"
	"github.com/aws/aws-sdk-go/service/vpn"
	"github.com/aws/aws-sdk-go/service/transitgateway"
	"github.com/aws/aws-sdk-go/service/networkfirewall"
	"github.com/aws/aws-sdk-go/service/shield"
	"github.com/aws/aws-sdk-go/service/xray"
	"github.com/aws/aws-sdk-go/service/applicationinsights"
	"github.com/aws/aws-sdk-go/service/cloudtrail"
	"github.com/aws/aws-sdk-go/service/macie"
	"github.com/aws/aws-sdk-go/service/detective"
	"github.com/aws/aws-sdk-go/service/securityhub"
	"github.com/aws/aws-sdk-go/service/accessanalyzer"
	"github.com/aws/aws-sdk-go/service/fms"
	"github.com/aws/aws-sdk-go/service/trustedadvisor"
	"github.com/aws/aws-sdk-go/service/support"
	"github.com/aws/aws-sdk-go/service/health"
	"github.com/aws/aws-sdk-go/service/servicequotas"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/configservice"
	"github.com/aws/aws-sdk-go/service/cloudcontrol"
	"github.com/aws/aws-sdk-go/service/ram"
	"github.com/aws/aws-sdk-go/service/wellarchitected"
	"github.com/aws/aws-sdk-go/service/controltower"
	"github.com/aws/aws-sdk-go/service/account"
	"github.com/aws/aws-sdk-go/service/billingconductor"
	"github.com/aws/aws-sdk-go/service/computeoptimizer"
	"github.com/aws/aws-sdk-go/service/savingsplans"
	"github.com/aws/aws-sdk-go/service/resourceexplorer2"
	"github.com/aws/aws-sdk-go/service/opensearchserverless"
	"github.com/aws/aws-sdk-go/service/memorydb"
	"github.com/aws/aws-sdk-go/service/grafana"
	"github.com/aws/aws-sdk-go/service/prometheusservice"
	"github.com/aws/aws-sdk-go/service/amp"
	"github.com/aws/aws-sdk-go/service/emrcontainers"
	"github.com/aws/aws-sdk-go/service/emrserverless"
	"github.com/aws/aws-sdk-go/service/finspace"
	"github.com/aws/aws-sdk-go/service/finspacedata"
	"github.com/aws/aws-sdk-go/service/healthlake"
	"github.com/aws/aws-sdk-go/service/lookoutequipment"
	"github.com/aws/aws-sdk-go/service/lookoutmetrics"
	"github.com/aws/aws-sdk-go/service/lookoutvision"
	"github.com/aws/aws-sdk-go/service/panorama"
	"github.com/aws/aws-sdk-go/service/braket"
	"github.com/aws/aws-sdk-go/service/nimblestudio"
	"github.com/aws/aws-sdk-go/service/proton"
	"github.com/aws/aws-sdk-go/service/apprunner"
	"github.com/aws/aws-sdk-go/service/appconfig"
	"github.com/aws/aws-sdk-go/service/appconfigdata"
	"github.com/aws/aws-sdk-go/service/appintegrations"
	"github.com/aws/aws-sdk-go/service/wisdom"
	"github.com/aws/aws-sdk-go/service/connect"
	"github.com/aws/aws-sdk-go/service/connectcases"
	"github.com/aws/aws-sdk-go/service/connectcampaigns"
	"github.com/aws/aws-sdk-go/service/connectcontactlens"
	"github.com/aws/aws-sdk-go/service/connectparticipant"
	"github.com/aws/aws-sdk-go/service/voiceid"
	"github.com/aws/aws-sdk-go/service/chimesdkidentity"
	"github.com/aws/aws-sdk-go/service/chimesdkmediapipelines"
	"github.com/aws/aws-sdk-go/service/chimesdkmessaging"
	"github.com/aws/aws-sdk-go/service/chimesdkvoice"
	"github.com/aws/aws-sdk-go/service/chimesdkmeetings"
	"github.com/aws/aws-sdk-go/service/networkmanager"
	"github.com/aws/aws-sdk-go/service/lightsail"
	"github.com/aws/aws-sdk-go/service/gamelift"
	"github.com/aws/aws-sdk-go/service/workspaces"
	"github.com/aws/aws-sdk-go/service/workspacesweb"
	"github.com/aws/aws-sdk-go/service/workdocs"
	"github.com/aws/aws-sdk-go/service/workmail"
	"github.com/aws/aws-sdk-go/service/workmailmessageflow"
	"github.com/aws/aws-sdk-go/service/worklink"
	"github.com/aws/aws-sdk-go/service/amplify"
	"github.com/aws/aws-sdk-go/service/amplifybackend"
	"github.com/aws/aws-sdk-go/service/amplifyuibuilder"
	"github.com/aws/aws-sdk-go/service/devicefarm"
	"github.com/aws/aws-sdk-go/service/mobile"
	"github.com/aws/aws-sdk-go/service/pinpoint"
	"github.com/aws/aws-sdk-go/service/pinpointEmail"
	"github.com/aws/aws-sdk-go/service/pinpointsmsvoice"
	"github.com/aws/aws-sdk-go/service/pinpointsmsvoicev2"
	"github.com/aws/aws-sdk-go/service/sesv2"
	"github.com/aws/aws-sdk-go/service/ses"
	"github.com/aws/aws-sdk-go/service/sms"
	"github.com/aws/aws-sdk-go/service/snowball"
	"github.com/aws/aws-sdk-go/service/snowdevicemanagement"
	"github.com/aws/aws-sdk-go/service/migrationhub"
	"github.com/aws/aws-sdk-go/service/migrationhubconfig"
	"github.com/aws/aws-sdk-go/service/migrationhuborchestrator"
	"github.com/aws/aws-sdk-go/service/migrationhubrefactorspaces"
	"github.com/aws/aws-sdk-go/service/migrationhubstrategy"
	"github.com/aws/aws-sdk-go/service/applicationmigrationservice"
	"github.com/aws/aws-sdk-go/service/dms"
	"github.com/aws/aws-sdk-go/service/drs"
	"github.com/aws/aws-sdk-go/service/mgn"
	"github.com/aws/aws-sdk-go/service/iot"
	"github.com/aws/aws-sdk-go/service/iot1clickdevicesservice"
	"github.com/aws/aws-sdk-go/service/iot1clickprojects"
	"github.com/aws/aws-sdk-go/service/iotanalytics"
	"github.com/aws/aws-sdk-go/service/iotdeviceadvisor"
	"github.com/aws/aws-sdk-go/service/iotevents"
	"github.com/aws/aws-sdk-go/service/ioteventsdata"
	"github.com/aws/aws-sdk-go/service/iotfleethub"
	"github.com/aws/aws-sdk-go/service/iotfleetwise"
	"github.com/aws/aws-sdk-go/service/iotjobsdataplane"
	"github.com/aws/aws-sdk-go/service/iotroborunner"
	"github.com/aws/aws-sdk-go/service/iotsecuretunneling"
	"github.com/aws/aws-sdk-go/service/iotsitewise"
	"github.com/aws/aws-sdk-go/service/iotthingsgraph"
	"github.com/aws/aws-sdk-go/service/iottwinmaker"
	"github.com/aws/aws-sdk-go/service/iotwireless"
	"github.com/aws/aws-sdk-go/service/greengrass"
	"github.com/aws/aws-sdk-go/service/greengrassv2"
	"github.com/aws/aws-sdk-go/service/robomaker"
	"github.com/aws/aws-sdk-go/service/batch"
	"github.com/aws/aws-sdk-go/service/glue"
	"github.com/aws/aws-sdk-go/service/gluedatabrew"
	"github.com/aws/aws-sdk-go/service/lakeformation"
	"github.com/aws/aws-sdk-go/service/databrew"
	"github.com/aws/aws-sdk-go/service/dataexchange"
	"github.com/aws/aws-sdk-go/service/datapipeline"
	"github.com/aws/aws-sdk-go/service/datasync"
	"github.com/aws/aws-sdk-go/service/emr"
	"github.com/aws/aws-sdk-go/service/emrserverless"
	"github.com/aws/aws-sdk-go/service/kinesis"
	"github.com/aws/aws-sdk-go/service/kinesisanalytics"
	"github.com/aws/aws-sdk-go/service/kinesisanalyticsv2"
	"github.com/aws/aws-sdk-go/service/kinesisfirehose"
	"github.com/aws/aws-sdk-go/service/kinesisvideo"
	"github.com/aws/aws-sdk-go/service/kinesisvideoarchivedmedia"
	"github.com/aws/aws-sdk-go/service/kinesisvideomedia"
	"github.com/aws/aws-sdk-go/service/kinesisvideosignalingchannels"
	"github.com/aws/aws-sdk-go/service/kinesisvideowebrtcstorage"
	"github.com/aws/aws-sdk-go/service/mwaa"
	"github.com/aws/aws-sdk-go/service/omics"
	"github.com/aws/aws-sdk-go/service/opensearch"
	"github.com/aws/aws-sdk-go/service/redshift"
	"github.com/aws/aws-sdk-go/service/redshiftdata"
	"github.com/aws/aws-sdk-go/service/redshiftserverless"
	"github.com/aws/aws-sdk-go/service/stepfunctions"
	"github.com/aws/aws-sdk-go/service/swf"
	"github.com/aws/aws-sdk-go/service/textract"
	"github.com/aws/aws-sdk-go/service/comprehend"
	"github.com/aws/aws-sdk-go/service/comprehendmedical"
	"github.com/aws/aws-sdk-go/service/kendra"
	"github.com/aws/aws-sdk-go/service/kendraranking"
	"github.com/aws/aws-sdk-go/service/lexmodelbuildingservice"
	"github.com/aws/aws-sdk-go/service/lexmodelsv2"
	"github.com/aws/aws-sdk-go/service/lexruntimeservice"
	"github.com/aws/aws-sdk-go/service/lexruntimev2"
	"github.com/aws/aws-sdk-go/service/personalize"
	"github.com/aws/aws-sdk-go/service/personalizeevents"
	"github.com/aws/aws-sdk-go/service/personalizeruntime"
	"github.com/aws/aws-sdk-go/service/polly"
	"github.com/aws/aws-sdk-go/service/rekognition"
	"github.com/aws/aws-sdk-go/service/sagemaker"
	"github.com/aws/aws-sdk-go/service/sagemakerfeaturestoreruntime"
	"github.com/aws/aws-sdk-go/service/sagemakermetrics"
	"github.com/aws/aws-sdk-go/service/sagemakerruntime"
	"github.com/aws/aws-sdk-go/service/sagemakergeospatial"
	"github.com/aws/aws-sdk-go/service/textract"
	"github.com/aws/aws-sdk-go/service/transcribe"
	"github.com/aws/aws-sdk-go/service/transcribestreaming"
	"github.com/aws/aws-sdk-go/service/translate"
	"github.com/aws/aws-sdk-go/service/voiceid"
	"github.com/aws/aws-sdk-go/service/bedrock"
	"github.com/aws/aws-sdk-go/service/bedrockagent"
	"github.com/aws/aws-sdk-go/service/bedrockagentruntime"
	"github.com/aws/aws-sdk-go/service/bedrockruntime"
	"github.com/aws/aws-sdk-go/service/codeartifact"
	"github.com/aws/aws-sdk-go/service/codebuild"
	"github.com/aws/aws-sdk-go/service/codecommit"
	"github.com/aws/aws-sdk-go/service/codedeploy"
	"github.com/aws/aws-sdk-go/service/codeguru"
	"github.com/aws/aws-sdk-go/service/codeguruprofiler"
	"github.com/aws/aws-sdk-go/service/codegurureviewer"
	"github.com/aws/aws-sdk-go/service/codepipeline"
	"github.com/aws/aws-sdk-go/service/codestar"
	"github.com/aws/aws-sdk-go/service/codestarconnections"
	"github.com/aws/aws-sdk-go/service/codestarnotifications"
	"github.com/aws/aws-sdk-go/service/cloud9"
	"github.com/aws/aws-sdk-go/service/cloudshell"
	"github.com/aws/aws-sdk-go/service/honeycode"
	"github.com/aws/aws-sdk-go/service/appflow"
	"github.com/aws/aws-sdk-go/service/appmesh"
	"github.com/aws/aws-sdk-go/service/appstream"
	"github.com/aws/aws-sdk-go/service/appsync"
	"github.com/aws/aws-sdk-go/service/backup"
	"github.com/aws/aws-sdk-go/service/backupstorage"
	"github.com/aws/aws-sdk-go/service/backupgateway"
	"github.com/aws/aws-sdk-go/service/chatbot"
	"github.com/aws/aws-sdk-go/service/cleanrooms"
	"github.com/aws/aws-sdk-go/service/clouddirectory"
	"github.com/aws/aws-sdk-go/service/cloudhsm"
	"github.com/aws/aws-sdk-go/service/cloudhsmv2"
	"github.com/aws/aws-sdk-go/service/cloudsearch"
	"github.com/aws/aws-sdk-go/service/cloudsearchdomain"
	"github.com/aws/aws-sdk-go/service/cloudwatchevents"
	"github.com/aws/aws-sdk-go/service/cloudwatchevidently"
	"github.com/aws/aws-sdk-go/service/cloudwatchrum"
	"github.com/aws/aws-sdk-go/service/cloudwatchsynthetics"
	"github.com/aws/aws-sdk-go/service/codewhisperer"
	"github.com/aws/aws-sdk-go/service/controltower"
	"github.com/aws/aws-sdk-go/service/cur"
	"github.com/aws/aws-sdk-go/service/customerprofiles"
	"github.com/aws/aws-sdk-go/service/dax"
	"github.com/aws/aws-sdk-go/service/dlm"
	"github.com/aws/aws-sdk-go/service/docdb"
	"github.com/aws/aws-sdk-go/service/docdbelastic"
	"github.com/aws/aws-sdk-go/service/dynamodbstreams"
	"github.com/aws/aws-sdk-go/service/ebs"
	"github.com/aws/aws-sdk-go/service/ec2instanceconnect"
	"github.com/aws/aws-sdk-go/service/ecr"
	"github.com/aws/aws-sdk-go/service/ecrpublic"
	"github.com/aws/aws-sdk-go/service/efs"
	"github.com/aws/aws-sdk-go/service/elasticbeanstalk"
	"github.com/aws/aws-sdk-go/service/elasticloadbalancing"
	"github.com/aws/aws-sdk-go/service/elasticloadbalancingv2"
	"github.com/aws/aws-sdk-go/service/elasticsearchservice"
	"github.com/aws/aws-sdk-go/service/elastictranscoder"
	"github.com/aws/aws-sdk-go/service/emrcontainers"
	"github.com/aws/aws-sdk-go/service/evidently"
	"github.com/aws/aws-sdk-go/service/fis"
	"github.com/aws/aws-sdk-go/service/fms"
	"github.com/aws/aws-sdk-go/service/forecast"
	"github.com/aws/aws-sdk-go/service/forecastquery"
	"github.com/aws/aws-sdk-go/service/frauddetector"
	"github.com/aws/aws-sdk-go/service/fsx"
	"github.com/aws/aws-sdk-go/service/glacier"
	"github.com/aws/aws-sdk-go/service/globalaccelerator"
	"github.com/aws/aws-sdk-go/service/groundstation"
	"github.com/aws/aws-sdk-go/service/guardduty"
	"github.com/aws/aws-sdk-go/service/imagebuilder"
	"github.com/aws/aws-sdk-go/service/importexport"
	"github.com/aws/aws-sdk-go/service/inspector2"
	"github.com/aws/aws-sdk-go/service/internetmonitor"
	"github.com/aws/aws-sdk-go/service/iotdata"
	"github.com/aws/aws-sdk-go/service/ivs"
	"github.com/aws/aws-sdk-go/service/ivschat"
	"github.com/aws/aws-sdk-go/service/ivsrealtime"
	"github.com/aws/aws-sdk-go/service/kafka"
	"github.com/aws/aws-sdk-go/service/kafkaconnect"
	"github.com/aws/aws-sdk-go/service/keyspaces"
	"github.com/aws/aws-sdk-go/service/licensemanager"
	"github.com/aws/aws-sdk-go/service/licensemanagerlinuxsubscriptions"
	"github.com/aws/aws-sdk-go/service/licensemanagerusersubscriptions"
	"github.com/aws/aws-sdk-go/service/locationservice"
	"github.com/aws/aws-sdk-go/service/logs"
	"github.com/aws/aws-sdk-go/service/machinelearning"
	"github.com/aws/aws-sdk-go/service/macie2"
	"github.com/aws/aws-sdk-go/service/managedblockchain"
	"github.com/aws/aws-sdk-go/service/managedblockchainquery"
	"github.com/aws/aws-sdk-go/service/mediaconnect"
	"github.com/aws/aws-sdk-go/service/mediaconvert"
	"github.com/aws/aws-sdk-go/service/medialive"
	"github.com/aws/aws-sdk-go/service/mediapackage"
	"github.com/aws/aws-sdk-go/service/mediapackagev2"
	"github.com/aws/aws-sdk-go/service/mediapackagevod"
	"github.com/aws/aws-sdk-go/service/mediastore"
	"github.com/aws/aws-sdk-go/service/mediastoredata"
	"github.com/aws/aws-sdk-go/service/mediatailor"
	"github.com/aws/aws-sdk-go/service/memorydb"
	"github.com/aws/aws-sdk-go/service/mq"
	"github.com/aws/aws-sdk-go/service/mturk"
	"github.com/aws/aws-sdk-go/service/neptune"
	"github.com/aws/aws-sdk-go/service/neptunedata"
	"github.com/aws/aws-sdk-go/service/networkfirewall"
	"github.com/aws/aws-sdk-go/service/oam"
	"github.com/aws/aws-sdk-go/service/opensearchserverless"
	"github.com/aws/aws-sdk-go/service/opsworks"
	"github.com/aws/aws-sdk-go/service/opsworkscm"
	"github.com/aws/aws-sdk-go/service/outposts"
	"github.com/aws/aws-sdk-go/service/payment"
	"github.com/aws/aws-sdk-go/service/paymentcryptography"
	"github.com/aws/aws-sdk-go/service/paymentcryptographydata"
	"github.com/aws/aws-sdk-go/service/pi"
	"github.com/aws/aws-sdk-go/service/pipes"
	"github.com/aws/aws-sdk-go/service/qldb"
	"github.com/aws/aws-sdk-go/service/qldbsession"
	"github.com/aws/aws-sdk-go/service/quicksight"
	"github.com/aws/aws-sdk-go/service/rbin"
	"github.com/aws/aws-sdk-go/service/rdsdata"
	"github.com/aws/aws-sdk-go/service/redshiftdataapiservice"
	"github.com/aws/aws-sdk-go/service/resourcegroupstaggingapi"
	"github.com/aws/aws-sdk-go/service/rolesanywhere"
	"github.com/aws/aws-sdk-go/service/rum"
	"github.com/aws/aws-sdk-go/service/s3control"
	"github.com/aws/aws-sdk-go/service/s3outposts"
	"github.com/aws/aws-sdk-go/service/scheduler"
	"github.com/aws/aws-sdk-go/service/securitylake"
	"github.com/aws/aws-sdk-go/service/serverlessapplicationrepository"
	"github.com/aws/aws-sdk-go/service/servicecatalog"
	"github.com/aws/aws-sdk-go/service/servicecatalogappregistry"
	"github.com/aws/aws-sdk-go/service/servicediscovery"
	"github.com/aws/aws-sdk-go/service/simspaceweaver"
	"github.com/aws/aws-sdk-go/service/ssoadmin"
	"github.com/aws/aws-sdk-go/service/ssooidc"
	"github.com/aws/aws-sdk-go/service/storagegateway"
	"github.com/aws/aws-sdk-go/service/support"
	"github.com/aws/aws-sdk-go/service/synthetics"
	"github.com/aws/aws-sdk-go/service/timestreamquery"
	"github.com/aws/aws-sdk-go/service/timestreamwrite"
	"github.com/aws/aws-sdk-go/service/transfer"
	"github.com/aws/aws-sdk-go/service/verifiedpermissions"
	"github.com/aws/aws-sdk-go/service/wafregional"
	"github.com/aws/aws-sdk-go/service/workdocs"
	"github.com/aws/aws-sdk-go/service/workspacesweb"
	"github.com/aws/aws-sdk-go/service/xray"
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

// AWSTestSuite manages AWS-specific infrastructure tests
type AWSTestSuite struct {
	Session    *session.Session
	Region     string
	TestID     string
	Config     TestConfig
	Logger     zerolog.Logger
	EC2        *ec2.EC2
	RDS        *rds.RDS
	S3         *s3.S3
	ELB        *elbv2.ELBV2
	CloudWatch *cloudwatch.CloudWatch
	IAM        *iam.IAM
	Lambda     *lambda.Lambda
	ECS        *ecs.ECS
	EKS        *eks.EKS
	KMS        *kms.KMS
	SecretsManager *secretsmanager.SecretsManager
	Route53    *route53.Route53
	ACM        *acm.ACM
	WAF        *wafv2.WAFV2
	GuardDuty  *guardduty.GuardDuty
	Inspector  *inspector.Inspector
	Config     *config.ConfigService
	Pricing    *pricing.Pricing
	CostExplorer *costexplorer.CostExplorer
	Budgets    *budgets.Budgets
	CloudTrail *cloudtrail.CloudTrail
	SecurityHub *securityhub.SecurityHub
	Backup     *backup.Backup
	AutoScaling *autoscaling.AutoScaling
	CloudFormation *cloudformation.CloudFormation
	STS        *sts.STS
	Organizations *organizations.Organizations
	SNS        *sns.SNS
	SQS        *sqs.SQS
	DynamoDB   *dynamodb.DynamoDB
	ElastiCache *elasticache.ElastiCache
	Neptune    *neptune.Neptune
	Redshift   *redshift.Redshift
	Kinesis    *kinesis.Kinesis
	Elasticsearch *elasticsearch.ElasticsearchService
	OpenSearch *opensearch.OpenSearch
	DataSync   *datasync.DataSync
	StorageGateway *storagegateway.StorageGateway
	FSx        *fsx.FSx
	EFS        *efs.EFS
	Glacier    *glacier.Glacier
	DirectConnect *directconnect.DirectConnect
	VPN        *vpn.VPN
	TransitGateway *transitgateway.TransitGateway
	NetworkFirewall *networkfirewall.NetworkFirewall
	Shield     *shield.Shield
	XRay       *xray.XRay
	ApplicationInsights *applicationinsights.ApplicationInsights
	TrustedAdvisor *trustedadvisor.TrustedAdvisor
	Support    *support.Support
	Health     *health.Health
	ServiceQuotas *servicequotas.ServiceQuotas
	ResourceGroupsTaggingAPI *resourcegroupstaggingapi.ResourceGroupsTaggingAPI
	ConfigService *configservice.ConfigService
	CloudControl *cloudcontrol.CloudControl
	RAM        *ram.RAM
	WellArchitected *wellarchitected.WellArchitected
	ControlTower *controltower.ControlTower
	Account    *account.Account
	BillingConductor *billingconductor.BillingConductor
	ComputeOptimizer *computeoptimizer.ComputeOptimizer
	SavingsPlans *savingsplans.SavingsPlans
	ResourceExplorer2 *resourceexplorer2.ResourceExplorer2
	OpenSearchServerless *opensearchserverless.OpenSearchServerless
	MemoryDB   *memorydb.MemoryDB
	Grafana    *grafana.Grafana
	PrometheusService *prometheusservice.PrometheusService
	AMP        *amp.AMP
	EMRContainers *emrcontainers.EMRContainers
	EMRServerless *emrserverless.EMRServerless
	FinSpace   *finspace.FinSpace
	FinSpaceData *finspacedata.FinSpaceData
	HealthLake *healthlake.HealthLake
	LookoutEquipment *lookoutequipment.LookoutEquipment
	LookoutMetrics *lookoutmetrics.LookoutMetrics
	LookoutVision *lookoutvision.LookoutVision
	Panorama   *panorama.Panorama
	Braket     *braket.Braket
	NimbleStudio *nimblestudio.NimbleStudio
	Proton     *proton.Proton
	AppRunner  *apprunner.AppRunner
	AppConfig  *appconfig.AppConfig
	AppConfigData *appconfigdata.AppConfigData
	AppIntegrations *appintegrations.AppIntegrations
	Wisdom     *wisdom.Wisdom
	Connect    *connect.Connect
	ConnectCases *connectcases.ConnectCases
	ConnectCampaigns *connectcampaigns.ConnectCampaigns
	ConnectContactLens *connectcontactlens.ConnectContactLens
	ConnectParticipant *connectparticipant.ConnectParticipant
	VoiceID    *voiceid.VoiceID
	ChimeSDKIdentity *chimesdkidentity.ChimeSDKIdentity
	ChimeSDKMediaPipelines *chimesdkmediapipelines.ChimeSDKMediaPipelines
	ChimeSDKMessaging *chimesdkmessaging.ChimeSDKMessaging
	ChimeSDKVoice *chimesdkvoice.ChimeSDKVoice
	ChimeSDKMeetings *chimesdkmeetings.ChimeSDKMeetings
	NetworkManager *networkmanager.NetworkManager
	Lightsail  *lightsail.Lightsail
	GameLift   *gamelift.GameLift
	WorkSpaces *workspaces.WorkSpaces
	WorkSpacesWeb *workspacesweb.WorkSpacesWeb
	WorkDocs   *workdocs.WorkDocs
	WorkMail   *workmail.WorkMail
	WorkMailMessageFlow *workmailmessageflow.WorkMailMessageFlow
	WorkLink   *worklink.WorkLink
	Amplify    *amplify.Amplify
	AmplifyBackend *amplifybackend.AmplifyBackend
	AmplifyUIBuilder *amplifyuibuilder.AmplifyUIBuilder
	DeviceFarm *devicefarm.DeviceFarm
	Mobile     *mobile.Mobile
	Pinpoint   *pinpoint.Pinpoint
	PinpointEmail *pinpointEmail.PinpointEmail
	PinpointSMSVoice *pinpointsmsvoice.PinpointSMSVoice
	PinpointSMSVoiceV2 *pinpointsmsvoicev2.PinpointSMSVoiceV2
	SESV2      *sesv2.SESV2
	SES        *ses.SES
	SMS        *sms.SMS
	Snowball   *snowball.Snowball
	SnowDeviceManagement *snowdevicemanagement.SnowDeviceManagement
	MigrationHub *migrationhub.MigrationHub
	MigrationHubConfig *migrationhubconfig.MigrationHubConfig
	MigrationHubOrchestrator *migrationhuborchestrator.MigrationHubOrchestrator
	MigrationHubRefactorSpaces *migrationhubrefactorspaces.MigrationHubRefactorSpaces
	MigrationHubStrategy *migrationhubstrategy.MigrationHubStrategy
	ApplicationMigrationService *applicationmigrationservice.ApplicationMigrationService
	DMS        *dms.DatabaseMigrationService
	DRS        *drs.DRS
	MGN        *mgn.MGN
	IoT        *iot.IoT
	IoT1ClickDevicesService *iot1clickdevicesservice.IoT1ClickDevicesService
	IoT1ClickProjects *iot1clickprojects.IoT1ClickProjects
	IoTAnalytics *iotanalytics.IoTAnalytics
	IoTDeviceAdvisor *iotdeviceadvisor.IoTDeviceAdvisor
	IoTEvents  *iotevents.IoTEvents
	IoTEventsData *ioteventsdata.IoTEventsData
	IoTFleetHub *iotfleethub.IoTFleetHub
	IoTFleetWise *iotfleetwise.IoTFleetWise
	IoTJobsDataPlane *iotjobsdataplane.IoTJobsDataPlane
	IoTRoboRunner *iotroborunner.IoTRoboRunner
	IoTSecureTunneling *iotsecuretunneling.IoTSecureTunneling
	IoTSiteWise *iotsitewise.IoTSiteWise
	IoTThingsGraph *iotthingsgraph.IoTThingsGraph
	IoTTwinMaker *iottwinmaker.IoTTwinMaker
	IoTWireless *iotwireless.IoTWireless
	Greengrass *greengrass.Greengrass
	GreengrassV2 *greengrassv2.GreengrassV2
	RoboMaker  *robomaker.RoboMaker
	Batch      *batch.Batch
	Glue       *glue.Glue
	GlueDataBrew *gluedatabrew.GlueDataBrew
	LakeFormation *lakeformation.LakeFormation
	DataBrew   *databrew.DataBrew
	DataExchange *dataexchange.DataExchange
	DataPipeline *datapipeline.DataPipeline
	DataSync   *datasync.DataSync
	EMR        *emr.EMR
	EMRServerless *emrserverless.EMRServerless
	Kinesis    *kinesis.Kinesis
	KinesisAnalytics *kinesisanalytics.KinesisAnalytics
	KinesisAnalyticsV2 *kinesisanalyticsv2.KinesisAnalyticsV2
	KinesisFirehose *kinesisfirehose.KinesisFirehose
	KinesisVideo *kinesisvideo.KinesisVideo
	KinesisVideoArchivedMedia *kinesisvideoarchivedmedia.KinesisVideoArchivedMedia
	KinesisVideoMedia *kinesisvideomedia.KinesisVideoMedia
	KinesisVideoSignalingChannels *kinesisvideosignalingchannels.KinesisVideoSignalingChannels
	KinesisVideoWebRTCStorage *kinesisvideowebrtcstorage.KinesisVideoWebRTCStorage
	MWAA       *mwaa.MWAA
	Omics      *omics.Omics
	OpenSearch *opensearch.OpenSearch
	Redshift   *redshift.Redshift
	RedshiftData *redshiftdata.RedshiftData
	RedshiftServerless *redshiftserverless.RedshiftServerless
	StepFunctions *stepfunctions.StepFunctions
	SWF        *swf.SWF
	Textract   *textract.Textract
	Comprehend *comprehend.Comprehend
	ComprehendMedical *comprehendmedical.ComprehendMedical
	Kendra     *kendra.Kendra
	KendraRanking *kendraranking.KendraRanking
	LexModelBuildingService *lexmodelbuildingservice.LexModelBuildingService
	LexModelsV2 *lexmodelsv2.LexModelsV2
	LexRuntimeService *lexruntimeservice.LexRuntimeService
	LexRuntimeV2 *lexruntimev2.LexRuntimeV2
	Personalize *personalize.Personalize
	PersonalizeEvents *personalizeevents.PersonalizeEvents
	PersonalizeRuntime *personalizeruntime.PersonalizeRuntime
	Polly      *polly.Polly
	Rekognition *rekognition.Rekognition
	SageMaker  *sagemaker.SageMaker
	SageMakerFeatureStoreRuntime *sagemakerfeaturestoreruntime.SageMakerFeatureStoreRuntime
	SageMakerMetrics *sagemakermetrics.SageMakerMetrics
	SageMakerRuntime *sagemakerruntime.SageMakerRuntime
	SageMakerGeospatial *sagemakergeospatial.SageMakerGeospatial
	Textract   *textract.Textract
	Transcribe *transcribe.TranscribeService
	TranscribeStreaming *transcribestreaming.TranscribeStreamingService
	Translate  *translate.Translate
	VoiceID    *voiceid.VoiceID
	Bedrock    *bedrock.Bedrock
	BedrockAgent *bedrockagent.BedrockAgent
	BedrockAgentRuntime *bedrockagentruntime.BedrockAgentRuntime
	BedrockRuntime *bedrockruntime.BedrockRuntime
	CodeArtifact *codeartifact.CodeArtifact
	CodeBuild  *codebuild.CodeBuild
	CodeCommit *codecommit.CodeCommit
	CodeDeploy *codedeploy.CodeDeploy
	CodeGuru   *codeguru.CodeGuru
	CodeGuruProfiler *codeguruprofiler.CodeGuruProfiler
	CodeGuruReviewer *codegurureviewer.CodeGuruReviewer
	CodePipeline *codepipeline.CodePipeline
	CodeStar   *codestar.CodeStar
	CodeStarConnections *codestarconnections.CodeStarConnections
	CodeStarNotifications *codestarnotifications.CodeStarNotifications
	Cloud9     *cloud9.Cloud9
	CloudShell *cloudshell.CloudShell
	Honeycode  *honeycode.Honeycode
	AppFlow    *appflow.AppFlow
	AppMesh    *appmesh.AppMesh
	AppStream  *appstream.AppStream
	AppSync    *appsync.AppSync
	Backup     *backup.Backup
	BackupStorage *backupstorage.BackupStorage
	BackupGateway *backupgateway.BackupGateway
	Chatbot    *chatbot.Chatbot
	CleanRooms *cleanrooms.CleanRooms
	CloudDirectory *clouddirectory.CloudDirectory
	CloudHSM   *cloudhsm.CloudHSM
	CloudHSMV2 *cloudhsmv2.CloudHSMV2
	CloudSearch *cloudsearch.CloudSearch
	CloudSearchDomain *cloudsearchdomain.CloudSearchDomain
	CloudWatchEvents *cloudwatchevents.CloudWatchEvents
	CloudWatchEvidently *cloudwatchevidently.CloudWatchEvidently
	CloudWatchRUM *cloudwatchrum.CloudWatchRUM
	CloudWatchSynthetics *cloudwatchsynthetics.CloudWatchSynthetics
	CodeWhisperer *codewhisperer.CodeWhisperer
	ControlTower *controltower.ControlTower
	CUR        *cur.CUR
	CustomerProfiles *customerprofiles.CustomerProfiles
	DAX        *dax.DAX
	DLM        *dlm.DLM
	DocDB      *docdb.DocDB
	DocDBElastic *docdbelastic.DocDBElastic
	DynamoDBStreams *dynamodbstreams.DynamoDBStreams
	EBS        *ebs.EBS
	EC2InstanceConnect *ec2instanceconnect.EC2InstanceConnect
	ECR        *ecr.ECR
	ECRPublic  *ecrpublic.ECRPublic
	EFS        *efs.EFS
	ElasticBeanstalk *elasticbeanstalk.ElasticBeanstalk
	ElasticLoadBalancing *elasticloadbalancing.ELB
	ElasticLoadBalancingV2 *elasticloadbalancingv2.ELBV2
	ElasticsearchService *elasticsearchservice.ElasticsearchService
	ElasticTranscoder *elastictranscoder.ElasticTranscoder
	EMRContainers *emrcontainers.EMRContainers
	Evidently  *evidently.Evidently
	FIS        *fis.FIS
	FMS        *fms.FMS
	Forecast   *forecast.ForecastService
	ForecastQuery *forecastquery.ForecastQueryService
	FraudDetector *frauddetector.FraudDetector
	FSx        *fsx.FSx
	Glacier    *glacier.Glacier
	GlobalAccelerator *globalaccelerator.GlobalAccelerator
	GroundStation *groundstation.GroundStation
	GuardDuty  *guardduty.GuardDuty
	ImageBuilder *imagebuilder.Imagebuilder
	ImportExport *importexport.ImportExport
	Inspector2 *inspector2.Inspector2
	InternetMonitor *internetmonitor.InternetMonitor
	IoTData    *iotdata.IoTDataPlane
	IVS        *ivs.IVS
	IVSChat    *ivschat.IVSChat
	IVSRealTime *ivsrealtime.IVSRealTime
	Kafka      *kafka.Kafka
	KafkaConnect *kafkaconnect.KafkaConnect
	Keyspaces  *keyspaces.Keyspaces
	LicenseManager *licensemanager.LicenseManager
	LicenseManagerLinuxSubscriptions *licensemanagerlinuxsubscriptions.LicenseManagerLinuxSubscriptions
	LicenseManagerUserSubscriptions *licensemanagerusersubscriptions.LicenseManagerUserSubscriptions
	LocationService *locationservice.LocationService
	Logs       *logs.CloudWatchLogs
	MachineLearning *machinelearning.MachineLearning
	Macie2     *macie2.Macie2
	ManagedBlockchain *managedblockchain.ManagedBlockchain
	ManagedBlockchainQuery *managedblockchainquery.ManagedBlockchainQuery
	MediaConnect *mediaconnect.MediaConnect
	MediaConvert *mediaconvert.MediaConvert
	MediaLive  *medialive.MediaLive
	MediaPackage *mediapackage.MediaPackage
	MediaPackageV2 *mediapackagev2.MediaPackageV2
	MediaPackageVod *mediapackagevod.MediaPackageVod
	MediaStore *mediastore.MediaStore
	MediaStoreData *mediastoredata.MediaStoreData
	MediaTailor *mediatailor.MediaTailor
	MemoryDB   *memorydb.MemoryDB
	MQ         *mq.MQ
	MTurk      *mturk.MTurk
	Neptune    *neptune.Neptune
	NeptuneData *neptunedata.NeptuneData
	NetworkFirewall *networkfirewall.NetworkFirewall
	OAM        *oam.OAM
	OpenSearchServerless *opensearchserverless.OpenSearchServerless
	OpsWorks   *opsworks.OpsWorks
	OpsWorksCM *opsworkscm.OpsWorksCM
	Outposts   *outposts.Outposts
	Payment    *payment.Payment
	PaymentCryptography *paymentcryptography.PaymentCryptography
	PaymentCryptographyData *paymentcryptographydata.PaymentCryptographyData
	PI         *pi.PI
	Pipes      *pipes.Pipes
	QLDB       *qldb.QLDB
	QLDBSession *qldbsession.QLDBSession
	QuickSight *quicksight.QuickSight
	RBin       *rbin.RBin
	RDSData    *rdsdata.RDSDataService
	RedshiftDataAPIService *redshiftdataapiservice.RedshiftDataAPIService
	ResourceGroupsTaggingAPI *resourcegroupstaggingapi.ResourceGroupsTaggingAPI
	RolesAnywhere *rolesanywhere.RolesAnywhere
	RUM        *rum.RUM
	S3Control  *s3control.S3Control
	S3Outposts *s3outposts.S3Outposts
	Scheduler  *scheduler.Scheduler
	SecurityLake *securitylake.SecurityLake
	ServerlessApplicationRepository *serverlessapplicationrepository.ServerlessApplicationRepository
	ServiceCatalog *servicecatalog.ServiceCatalog
	ServiceCatalogAppRegistry *servicecatalogappregistry.ServiceCatalogAppRegistry
	ServiceDiscovery *servicediscovery.ServiceDiscovery
	SimSpaceWeaver *simspaceweaver.SimSpaceWeaver
	SSOAdmin   *ssoadmin.SSOAdmin
	SSOOIDC    *ssooidc.SSOOIDC
	StorageGateway *storagegateway.StorageGateway
	Support    *support.Support
	Synthetics *synthetics.Synthetics
	TimestreamQuery *timestreamquery.TimestreamQuery
	TimestreamWrite *timestreamwrite.TimestreamWrite
	Transfer   *transfer.Transfer
	VerifiedPermissions *verifiedpermissions.VerifiedPermissions
	WAFRegional *wafregional.WAFRegional
	WorkDocs   *workdocs.WorkDocs
	WorkSpacesWeb *workspacesweb.WorkSpacesWeb
	XRay       *xray.XRay
}

// NewAWSTestSuite creates a new AWS test suite
func NewAWSTestSuite(region string, config TestConfig) (*AWSTestSuite, error) {
	testID := uuid.New().String()[:8]
	
	// Create AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(region),
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to create AWS session")
	}

	// Initialize logger
	logger := log.With().
		Str("service", "aws-test-suite").
		Str("region", region).
		Str("test_id", testID).
		Logger()

	// Create AWS service clients
	suite := &AWSTestSuite{
		Session: sess,
		Region:  region,
		TestID:  testID,
		Config:  config,
		Logger:  logger,
		
		// Core services
		EC2:        ec2.New(sess),
		RDS:        rds.New(sess),
		S3:         s3.New(sess),
		ELB:        elbv2.New(sess),
		CloudWatch: cloudwatch.New(sess),
		IAM:        iam.New(sess),
		Lambda:     lambda.New(sess),
		ECS:        ecs.New(sess),
		EKS:        eks.New(sess),
		
		// Security services
		KMS:            kms.New(sess),
		SecretsManager: secretsmanager.New(sess),
		WAF:            wafv2.New(sess),
		GuardDuty:      guardduty.New(sess),
		Inspector:      inspector.New(sess),
		SecurityHub:    securityhub.New(sess),
		CloudTrail:     cloudtrail.New(sess),
		
		// Network services
		Route53:         route53.New(sess),
		ACM:             acm.New(sess),
		DirectConnect:   directconnect.New(sess),
		VPN:             vpn.New(sess),
		TransitGateway:  transitgateway.New(sess),
		NetworkFirewall: networkfirewall.New(sess),
		Shield:          shield.New(sess),
		
		// Monitoring services
		XRay:                xray.New(sess),
		ApplicationInsights: applicationinsights.New(sess),
		
		// Management services
		CloudFormation:      cloudformation.New(sess),
		STS:                 sts.New(sess),
		Organizations:       organizations.New(sess),
		Config:              config.New(sess),
		TrustedAdvisor:      trustedadvisor.New(sess),
		Support:             support.New(sess),
		Health:              health.New(sess),
		ServiceQuotas:       servicequotas.New(sess),
		ResourceGroupsTaggingAPI: resourcegroupstaggingapi.New(sess),
		ConfigService:       configservice.New(sess),
		CloudControl:        cloudcontrol.New(sess),
		RAM:                 ram.New(sess),
		WellArchitected:     wellarchitected.New(sess),
		ControlTower:        controltower.New(sess),
		
		// Cost management services
		Pricing:           pricing.New(sess),
		CostExplorer:      costexplorer.New(sess),
		Budgets:           budgets.New(sess),
		Account:           account.New(sess),
		BillingConductor:  billingconductor.New(sess),
		ComputeOptimizer:  computeoptimizer.New(sess),
		SavingsPlans:      savingsplans.New(sess),
		
		// Backup services
		Backup:         backup.New(sess),
		AutoScaling:    autoscaling.New(sess),
		
		// Database services
		DynamoDB:    dynamodb.New(sess),
		ElastiCache: elasticache.New(sess),
		Neptune:     neptune.New(sess),
		Redshift:    redshift.New(sess),
		
		// Analytics services
		Kinesis:       kinesis.New(sess),
		Elasticsearch: elasticsearch.New(sess),
		OpenSearch:    opensearch.New(sess),
		
		// Storage services
		DataSync:       datasync.New(sess),
		StorageGateway: storagegateway.New(sess),
		FSx:            fsx.New(sess),
		EFS:            efs.New(sess),
		Glacier:        glacier.New(sess),
		
		// Messaging services
		SNS: sns.New(sess),
		SQS: sqs.New(sess),
		
		// Additional services
		ResourceExplorer2:    resourceexplorer2.New(sess),
		OpenSearchServerless: opensearchserverless.New(sess),
		MemoryDB:             memorydb.New(sess),
		Grafana:              grafana.New(sess),
		PrometheusService:    prometheusservice.New(sess),
		AMP:                  amp.New(sess),
	}

	return suite, nil
}

// TestAWSInfrastructure runs comprehensive AWS infrastructure tests
func TestAWSInfrastructure(t *testing.T) {
	t.Parallel()

	// Load test configuration
	config, err := LoadTestConfig("test-config.yaml")
	require.NoError(t, err)

	// Create AWS test suite
	suite, err := NewAWSTestSuite(config.Region, config)
	require.NoError(t, err)

	suite.Logger.Info().Msg("Starting AWS infrastructure tests")

	// Test stages
	t.Run("VPC", suite.TestVPC)
	t.Run("EC2", suite.TestEC2)
	t.Run("RDS", suite.TestRDS)
	t.Run("S3", suite.TestS3)
	t.Run("ELB", suite.TestELB)
	t.Run("IAM", suite.TestIAM)
	t.Run("Lambda", suite.TestLambda)
	t.Run("ECS", suite.TestECS)
	t.Run("EKS", suite.TestEKS)
	t.Run("Security", suite.TestSecurity)
	t.Run("Monitoring", suite.TestMonitoring)
	t.Run("Backup", suite.TestBackup)
	t.Run("Cost", suite.TestCost)
	t.Run("Compliance", suite.TestCompliance)
	t.Run("Performance", suite.TestPerformance)
	t.Run("Disaster Recovery", suite.TestDisasterRecovery)
	t.Run("Chaos Engineering", suite.TestChaosEngineering)

	suite.Logger.Info().Msg("AWS infrastructure tests completed")
}

// TestVPC tests VPC infrastructure
func (suite *AWSTestSuite) TestVPC(t *testing.T) {
	suite.Logger.Info().Msg("Testing VPC infrastructure")

	// Test VPC creation and configuration
	t.Run("VPC Creation", func(t *testing.T) {
		// Test VPC exists
		vpcs, err := suite.EC2.DescribeVpcs(&ec2.DescribeVpcsInput{})
		require.NoError(t, err)
		assert.True(t, len(vpcs.Vpcs) > 0, "At least one VPC should exist")

		// Test VPC configuration
		for _, vpc := range vpcs.Vpcs {
			// Test CIDR block
			assert.NotEmpty(t, vpc.CidrBlock, "VPC should have a CIDR block")
			
			// Test tags
			if suite.Config.Tags != nil {
				for key, value := range suite.Config.Tags {
					found := false
					for _, tag := range vpc.Tags {
						if *tag.Key == key && *tag.Value == value {
							found = true
							break
						}
					}
					assert.True(t, found, "VPC should have required tags")
				}
			}
		}
	})

	// Test Subnets
	t.Run("Subnets", func(t *testing.T) {
		subnets, err := suite.EC2.DescribeSubnets(&ec2.DescribeSubnetsInput{})
		require.NoError(t, err)
		assert.True(t, len(subnets.Subnets) > 0, "At least one subnet should exist")

		// Test subnet configuration
		for _, subnet := range subnets.Subnets {
			// Test availability zone
			assert.NotEmpty(t, subnet.AvailabilityZone, "Subnet should have an availability zone")
			
			// Test CIDR block
			assert.NotEmpty(t, subnet.CidrBlock, "Subnet should have a CIDR block")
			
			// Test state
			assert.Equal(t, "available", *subnet.State, "Subnet should be available")
		}
	})

	// Test Route Tables
	t.Run("Route Tables", func(t *testing.T) {
		routeTables, err := suite.EC2.DescribeRouteTables(&ec2.DescribeRouteTablesInput{})
		require.NoError(t, err)
		assert.True(t, len(routeTables.RouteTables) > 0, "At least one route table should exist")

		// Test route table configuration
		for _, routeTable := range routeTables.RouteTables {
			// Test associations
			assert.True(t, len(routeTable.Associations) > 0, "Route table should have associations")
			
			// Test routes
			assert.True(t, len(routeTable.Routes) > 0, "Route table should have routes")
		}
	})

	// Test Internet Gateway
	t.Run("Internet Gateway", func(t *testing.T) {
		igws, err := suite.EC2.DescribeInternetGateways(&ec2.DescribeInternetGatewaysInput{})
		require.NoError(t, err)
		assert.True(t, len(igws.InternetGateways) > 0, "At least one internet gateway should exist")

		// Test internet gateway configuration
		for _, igw := range igws.InternetGateways {
			// Test state
			assert.Equal(t, "available", *igw.State, "Internet gateway should be available")
			
			// Test attachments
			assert.True(t, len(igw.Attachments) > 0, "Internet gateway should have attachments")
		}
	})

	// Test NAT Gateways
	t.Run("NAT Gateways", func(t *testing.T) {
		nats, err := suite.EC2.DescribeNatGateways(&ec2.DescribeNatGatewaysInput{})
		require.NoError(t, err)
		
		// Test NAT gateway configuration
		for _, nat := range nats.NatGateways {
			// Test state
			assert.Equal(t, "available", *nat.State, "NAT gateway should be available")
			
			// Test subnet
			assert.NotEmpty(t, nat.SubnetId, "NAT gateway should have a subnet")
		}
	})

	// Test Security Groups
	t.Run("Security Groups", func(t *testing.T) {
		securityGroups, err := suite.EC2.DescribeSecurityGroups(&ec2.DescribeSecurityGroupsInput{})
		require.NoError(t, err)
		assert.True(t, len(securityGroups.SecurityGroups) > 0, "At least one security group should exist")

		// Test security group configuration
		for _, sg := range securityGroups.SecurityGroups {
			// Test name
			assert.NotEmpty(t, sg.GroupName, "Security group should have a name")
			
			// Test description
			assert.NotEmpty(t, sg.Description, "Security group should have a description")
			
			// Test VPC
			assert.NotEmpty(t, sg.VpcId, "Security group should belong to a VPC")
		}
	})

	// Test Network ACLs
	t.Run("Network ACLs", func(t *testing.T) {
		nacls, err := suite.EC2.DescribeNetworkAcls(&ec2.DescribeNetworkAclsInput{})
		require.NoError(t, err)
		assert.True(t, len(nacls.NetworkAcls) > 0, "At least one network ACL should exist")

		// Test network ACL configuration
		for _, nacl := range nacls.NetworkAcls {
			// Test associations
			assert.True(t, len(nacl.Associations) > 0, "Network ACL should have associations")
			
			// Test entries
			assert.True(t, len(nacl.Entries) > 0, "Network ACL should have entries")
		}
	})

	suite.Logger.Info().Msg("VPC infrastructure tests completed")
}

// TestEC2 tests EC2 infrastructure
func (suite *AWSTestSuite) TestEC2(t *testing.T) {
	suite.Logger.Info().Msg("Testing EC2 infrastructure")

	// Test EC2 Instances
	t.Run("Instances", func(t *testing.T) {
		instances, err := suite.EC2.DescribeInstances(&ec2.DescribeInstancesInput{})
		require.NoError(t, err)

		// Test instance configuration
		for _, reservation := range instances.Reservations {
			for _, instance := range reservation.Instances {
				// Test instance state
				if *instance.State.Name != "terminated" {
					assert.Contains(t, []string{"pending", "running", "stopping", "stopped"}, 
						*instance.State.Name, "Instance should be in a valid state")
				}
				
				// Test instance type
				assert.NotEmpty(t, instance.InstanceType, "Instance should have a type")
				
				// Test AMI
				assert.NotEmpty(t, instance.ImageId, "Instance should have an AMI")
				
				// Test security groups
				assert.True(t, len(instance.SecurityGroups) > 0, "Instance should have security groups")
				
				// Test subnet
				if instance.SubnetId != nil {
					assert.NotEmpty(t, *instance.SubnetId, "Instance should have a subnet")
				}
			}
		}
	})

	// Test AMIs
	t.Run("AMIs", func(t *testing.T) {
		amis, err := suite.EC2.DescribeImages(&ec2.DescribeImagesInput{
			Owners: []*string{aws.String("self")},
		})
		require.NoError(t, err)

		// Test AMI configuration
		for _, ami := range amis.Images {
			// Test state
			assert.Equal(t, "available", *ami.State, "AMI should be available")
			
			// Test architecture
			assert.Contains(t, []string{"i386", "x86_64", "arm64"}, *ami.Architecture, 
				"AMI should have a valid architecture")
			
			// Test virtualization type
			assert.Contains(t, []string{"hvm", "paravirtual"}, *ami.VirtualizationType,
				"AMI should have a valid virtualization type")
		}
	})

	// Test Key Pairs
	t.Run("Key Pairs", func(t *testing.T) {
		keyPairs, err := suite.EC2.DescribeKeyPairs(&ec2.DescribeKeyPairsInput{})
		require.NoError(t, err)

		// Test key pair configuration
		for _, keyPair := range keyPairs.KeyPairs {
			// Test name
			assert.NotEmpty(t, keyPair.KeyName, "Key pair should have a name")
			
			// Test fingerprint
			assert.NotEmpty(t, keyPair.KeyFingerprint, "Key pair should have a fingerprint")
		}
	})

	// Test EBS Volumes
	t.Run("EBS Volumes", func(t *testing.T) {
		volumes, err := suite.EC2.DescribeVolumes(&ec2.DescribeVolumesInput{})
		require.NoError(t, err)

		// Test volume configuration
		for _, volume := range volumes.Volumes {
			// Test state
			assert.Contains(t, []string{"creating", "available", "in-use", "deleting", "deleted", "error"}, 
				*volume.State, "Volume should have a valid state")
			
			// Test size
			assert.True(t, *volume.Size > 0, "Volume should have a size greater than 0")
			
			// Test volume type
			assert.Contains(t, []string{"gp2", "gp3", "io1", "io2", "sc1", "st1", "standard"}, 
				*volume.VolumeType, "Volume should have a valid type")
			
			// Test availability zone
			assert.NotEmpty(t, volume.AvailabilityZone, "Volume should have an availability zone")
		}
	})

	// Test Snapshots
	t.Run("Snapshots", func(t *testing.T) {
		snapshots, err := suite.EC2.DescribeSnapshots(&ec2.DescribeSnapshotsInput{
			OwnerIds: []*string{aws.String("self")},
		})
		require.NoError(t, err)

		// Test snapshot configuration
		for _, snapshot := range snapshots.Snapshots {
			// Test state
			assert.Contains(t, []string{"pending", "completed", "error"}, 
				*snapshot.State, "Snapshot should have a valid state")
			
			// Test volume size
			assert.True(t, *snapshot.VolumeSize > 0, "Snapshot should have a volume size greater than 0")
			
			// Test progress
			if *snapshot.State == "completed" {
				assert.Equal(t, "100%", *snapshot.Progress, "Completed snapshot should have 100% progress")
			}
		}
	})

	suite.Logger.Info().Msg("EC2 infrastructure tests completed")
}

// TestRDS tests RDS infrastructure
func (suite *AWSTestSuite) TestRDS(t *testing.T) {
	suite.Logger.Info().Msg("Testing RDS infrastructure")

	// Test RDS Instances
	t.Run("DB Instances", func(t *testing.T) {
		instances, err := suite.RDS.DescribeDBInstances(&rds.DescribeDBInstancesInput{})
		require.NoError(t, err)

		// Test instance configuration
		for _, instance := range instances.DBInstances {
			// Test instance state
			assert.Contains(t, []string{"creating", "available", "modifying", "deleting", "deleted"}, 
				*instance.DBInstanceStatus, "DB instance should have a valid state")
			
			// Test instance class
			assert.NotEmpty(t, instance.DBInstanceClass, "DB instance should have a class")
			
			// Test engine
			assert.NotEmpty(t, instance.Engine, "DB instance should have an engine")
			
			// Test allocated storage
			if instance.AllocatedStorage != nil {
				assert.True(t, *instance.AllocatedStorage > 0, "DB instance should have allocated storage")
			}
			
			// Test backup retention period
			if instance.BackupRetentionPeriod != nil {
				assert.True(t, *instance.BackupRetentionPeriod >= 0, "Backup retention period should be non-negative")
			}
			
			// Test multi-AZ
			if instance.MultiAZ != nil {
				suite.Logger.Info().Bool("multi_az", *instance.MultiAZ).Msg("Multi-AZ configuration")
			}
		}
	})

	// Test RDS Clusters
	t.Run("DB Clusters", func(t *testing.T) {
		clusters, err := suite.RDS.DescribeDBClusters(&rds.DescribeDBClustersInput{})
		require.NoError(t, err)

		// Test cluster configuration
		for _, cluster := range clusters.DBClusters {
			// Test cluster state
			assert.Contains(t, []string{"creating", "available", "modifying", "deleting", "deleted"}, 
				*cluster.Status, "DB cluster should have a valid state")
			
			// Test engine
			assert.NotEmpty(t, cluster.Engine, "DB cluster should have an engine")
			
			// Test cluster members
			assert.True(t, len(cluster.DBClusterMembers) > 0, "DB cluster should have members")
		}
	})

	// Test DB Subnet Groups
	t.Run("DB Subnet Groups", func(t *testing.T) {
		subnetGroups, err := suite.RDS.DescribeDBSubnetGroups(&rds.DescribeDBSubnetGroupsInput{})
		require.NoError(t, err)

		// Test subnet group configuration
		for _, subnetGroup := range subnetGroups.DBSubnetGroups {
			// Test name
			assert.NotEmpty(t, subnetGroup.DBSubnetGroupName, "DB subnet group should have a name")
			
			// Test description
			assert.NotEmpty(t, subnetGroup.DBSubnetGroupDescription, "DB subnet group should have a description")
			
			// Test VPC
			assert.NotEmpty(t, subnetGroup.VpcId, "DB subnet group should belong to a VPC")
			
			// Test subnets
			assert.True(t, len(subnetGroup.Subnets) > 0, "DB subnet group should have subnets")
		}
	})

	// Test DB Parameter Groups
	t.Run("DB Parameter Groups", func(t *testing.T) {
		parameterGroups, err := suite.RDS.DescribeDBParameterGroups(&rds.DescribeDBParameterGroupsInput{})
		require.NoError(t, err)

		// Test parameter group configuration
		for _, parameterGroup := range parameterGroups.DBParameterGroups {
			// Test name
			assert.NotEmpty(t, parameterGroup.DBParameterGroupName, "DB parameter group should have a name")
			
			// Test family
			assert.NotEmpty(t, parameterGroup.DBParameterGroupFamily, "DB parameter group should have a family")
			
			// Test description
			assert.NotEmpty(t, parameterGroup.Description, "DB parameter group should have a description")
		}
	})

	// Test DB Snapshots
	t.Run("DB Snapshots", func(t *testing.T) {
		snapshots, err := suite.RDS.DescribeDBSnapshots(&rds.DescribeDBSnapshotsInput{
			SnapshotType: aws.String("manual"),
		})
		require.NoError(t, err)

		// Test snapshot configuration
		for _, snapshot := range snapshots.DBSnapshots {
			// Test state
			assert.Contains(t, []string{"creating", "available", "copying", "deleting"}, 
				*snapshot.Status, "DB snapshot should have a valid state")
			
			// Test source DB instance
			assert.NotEmpty(t, snapshot.DBInstanceIdentifier, "DB snapshot should have a source instance")
			
			// Test snapshot type
			assert.Equal(t, "manual", *snapshot.SnapshotType, "Snapshot type should be manual")
		}
	})

	suite.Logger.Info().Msg("RDS infrastructure tests completed")
}

// TestS3 tests S3 infrastructure
func (suite *AWSTestSuite) TestS3(t *testing.T) {
	suite.Logger.Info().Msg("Testing S3 infrastructure")

	// Test S3 Buckets
	t.Run("Buckets", func(t *testing.T) {
		buckets, err := suite.S3.ListBuckets(&s3.ListBucketsInput{})
		require.NoError(t, err)

		// Test bucket configuration
		for _, bucket := range buckets.Buckets {
			// Test bucket name
			assert.NotEmpty(t, bucket.Name, "Bucket should have a name")
			
			// Test creation date
			assert.NotNil(t, bucket.CreationDate, "Bucket should have a creation date")
			
			// Test bucket region
			region, err := suite.S3.GetBucketLocation(&s3.GetBucketLocationInput{
				Bucket: bucket.Name,
			})
			require.NoError(t, err)
			suite.Logger.Info().Str("bucket", *bucket.Name).Str("region", *region.LocationConstraint).Msg("Bucket region")
			
			// Test bucket encryption
			_, err = suite.S3.GetBucketEncryption(&s3.GetBucketEncryptionInput{
				Bucket: bucket.Name,
			})
			if err != nil {
				suite.Logger.Warn().Str("bucket", *bucket.Name).Msg("Bucket encryption not configured")
			}
			
			// Test bucket versioning
			versioning, err := suite.S3.GetBucketVersioning(&s3.GetBucketVersioningInput{
				Bucket: bucket.Name,
			})
			require.NoError(t, err)
			suite.Logger.Info().Str("bucket", *bucket.Name).Str("versioning", *versioning.Status).Msg("Bucket versioning")
			
			// Test bucket lifecycle
			_, err = suite.S3.GetBucketLifecycleConfiguration(&s3.GetBucketLifecycleConfigurationInput{
				Bucket: bucket.Name,
			})
			if err != nil {
				suite.Logger.Warn().Str("bucket", *bucket.Name).Msg("Bucket lifecycle not configured")
			}
		}
	})

	// Test S3 Bucket Policies
	t.Run("Bucket Policies", func(t *testing.T) {
		buckets, err := suite.S3.ListBuckets(&s3.ListBucketsInput{})
		require.NoError(t, err)

		for _, bucket := range buckets.Buckets {
			// Test bucket policy
			_, err = suite.S3.GetBucketPolicy(&s3.GetBucketPolicyInput{
				Bucket: bucket.Name,
			})
			if err != nil {
				suite.Logger.Warn().Str("bucket", *bucket.Name).Msg("Bucket policy not configured")
			}
			
			// Test bucket ACL
			acl, err := suite.S3.GetBucketAcl(&s3.GetBucketAclInput{
				Bucket: bucket.Name,
			})
			require.NoError(t, err)
			assert.NotNil(t, acl.Owner, "Bucket should have an owner")
			assert.True(t, len(acl.Grants) > 0, "Bucket should have grants")
		}
	})

	suite.Logger.Info().Msg("S3 infrastructure tests completed")
}

// TestELB tests ELB infrastructure
func (suite *AWSTestSuite) TestELB(t *testing.T) {
	suite.Logger.Info().Msg("Testing ELB infrastructure")

	// Test Application Load Balancers
	t.Run("Application Load Balancers", func(t *testing.T) {
		albs, err := suite.ELB.DescribeLoadBalancers(&elbv2.DescribeLoadBalancersInput{})
		require.NoError(t, err)

		// Test load balancer configuration
		for _, alb := range albs.LoadBalancers {
			// Test state
			assert.Equal(t, "active", *alb.State.Code, "Load balancer should be active")
			
			// Test scheme
			assert.Contains(t, []string{"internet-facing", "internal"}, *alb.Scheme, 
				"Load balancer should have a valid scheme")
			
			// Test type
			assert.Contains(t, []string{"application", "network", "gateway"}, *alb.Type,
				"Load balancer should have a valid type")
			
			// Test availability zones
			assert.True(t, len(alb.AvailabilityZones) > 0, "Load balancer should have availability zones")
			
			// Test security groups
			if alb.SecurityGroups != nil {
				assert.True(t, len(alb.SecurityGroups) > 0, "Load balancer should have security groups")
			}
		}
	})

	// Test Target Groups
	t.Run("Target Groups", func(t *testing.T) {
		targetGroups, err := suite.ELB.DescribeTargetGroups(&elbv2.DescribeTargetGroupsInput{})
		require.NoError(t, err)

		// Test target group configuration
		for _, tg := range targetGroups.TargetGroups {
			// Test protocol
			assert.Contains(t, []string{"HTTP", "HTTPS", "TCP", "TLS", "UDP", "TCP_UDP", "GENEVE"}, 
				*tg.Protocol, "Target group should have a valid protocol")
			
			// Test port
			assert.True(t, *tg.Port > 0 && *tg.Port <= 65535, "Target group should have a valid port")
			
			// Test VPC
			assert.NotEmpty(t, tg.VpcId, "Target group should belong to a VPC")
			
			// Test health check
			assert.NotEmpty(t, tg.HealthCheckPath, "Target group should have a health check path")
			assert.NotEmpty(t, tg.HealthCheckProtocol, "Target group should have a health check protocol")
		}
	})

	// Test Listeners
	t.Run("Listeners", func(t *testing.T) {
		albs, err := suite.ELB.DescribeLoadBalancers(&elbv2.DescribeLoadBalancersInput{})
		require.NoError(t, err)

		for _, alb := range albs.LoadBalancers {
			listeners, err := suite.ELB.DescribeListeners(&elbv2.DescribeListenersInput{
				LoadBalancerArn: alb.LoadBalancerArn,
			})
			require.NoError(t, err)

			// Test listener configuration
			for _, listener := range listeners.Listeners {
				// Test protocol
				assert.Contains(t, []string{"HTTP", "HTTPS", "TCP", "TLS", "UDP", "TCP_UDP", "GENEVE"}, 
					*listener.Protocol, "Listener should have a valid protocol")
				
				// Test port
				assert.True(t, *listener.Port > 0 && *listener.Port <= 65535, "Listener should have a valid port")
				
				// Test default actions
				assert.True(t, len(listener.DefaultActions) > 0, "Listener should have default actions")
			}
		}
	})

	suite.Logger.Info().Msg("ELB infrastructure tests completed")
}

// TestIAM tests IAM infrastructure
func (suite *AWSTestSuite) TestIAM(t *testing.T) {
	suite.Logger.Info().Msg("Testing IAM infrastructure")

	// Test IAM Roles
	t.Run("Roles", func(t *testing.T) {
		roles, err := suite.IAM.ListRoles(&iam.ListRolesInput{})
		require.NoError(t, err)

		// Test role configuration
		for _, role := range roles.Roles {
			// Test role name
			assert.NotEmpty(t, role.RoleName, "Role should have a name")
			
			// Test assume role policy
			assert.NotEmpty(t, role.AssumeRolePolicyDocument, "Role should have an assume role policy")
			
			// Test creation date
			assert.NotNil(t, role.CreateDate, "Role should have a creation date")
			
			// Test ARN
			assert.NotEmpty(t, role.Arn, "Role should have an ARN")
		}
	})

	// Test IAM Policies
	t.Run("Policies", func(t *testing.T) {
		policies, err := suite.IAM.ListPolicies(&iam.ListPoliciesInput{
			Scope: aws.String("Local"),
		})
		require.NoError(t, err)

		// Test policy configuration
		for _, policy := range policies.Policies {
			// Test policy name
			assert.NotEmpty(t, policy.PolicyName, "Policy should have a name")
			
			// Test ARN
			assert.NotEmpty(t, policy.Arn, "Policy should have an ARN")
			
			// Test creation date
			assert.NotNil(t, policy.CreateDate, "Policy should have a creation date")
			
			// Test default version
			assert.NotEmpty(t, policy.DefaultVersionId, "Policy should have a default version")
		}
	})

	// Test IAM Users
	t.Run("Users", func(t *testing.T) {
		users, err := suite.IAM.ListUsers(&iam.ListUsersInput{})
		require.NoError(t, err)

		// Test user configuration
		for _, user := range users.Users {
			// Test user name
			assert.NotEmpty(t, user.UserName, "User should have a name")
			
			// Test ARN
			assert.NotEmpty(t, user.Arn, "User should have an ARN")
			
			// Test creation date
			assert.NotNil(t, user.CreateDate, "User should have a creation date")
		}
	})

	// Test IAM Groups
	t.Run("Groups", func(t *testing.T) {
		groups, err := suite.IAM.ListGroups(&iam.ListGroupsInput{})
		require.NoError(t, err)

		// Test group configuration
		for _, group := range groups.Groups {
			// Test group name
			assert.NotEmpty(t, group.GroupName, "Group should have a name")
			
			// Test ARN
			assert.NotEmpty(t, group.Arn, "Group should have an ARN")
			
			// Test creation date
			assert.NotNil(t, group.CreateDate, "Group should have a creation date")
		}
	})

	suite.Logger.Info().Msg("IAM infrastructure tests completed")
}

// TestLambda tests Lambda infrastructure
func (suite *AWSTestSuite) TestLambda(t *testing.T) {
	suite.Logger.Info().Msg("Testing Lambda infrastructure")

	// Test Lambda Functions
	t.Run("Functions", func(t *testing.T) {
		functions, err := suite.Lambda.ListFunctions(&lambda.ListFunctionsInput{})
		require.NoError(t, err)

		// Test function configuration
		for _, function := range functions.Functions {
			// Test function name
			assert.NotEmpty(t, function.FunctionName, "Function should have a name")
			
			// Test runtime
			assert.NotEmpty(t, function.Runtime, "Function should have a runtime")
			
			// Test handler
			assert.NotEmpty(t, function.Handler, "Function should have a handler")
			
			// Test role
			assert.NotEmpty(t, function.Role, "Function should have a role")
			
			// Test state
			assert.Equal(t, "Active", *function.State, "Function should be active")
			
			// Test timeout
			assert.True(t, *function.Timeout > 0, "Function should have a timeout")
			
			// Test memory size
			assert.True(t, *function.MemorySize > 0, "Function should have memory size")
		}
	})

	// Test Lambda Layers
	t.Run("Layers", func(t *testing.T) {
		layers, err := suite.Lambda.ListLayers(&lambda.ListLayersInput{})
		require.NoError(t, err)

		// Test layer configuration
		for _, layer := range layers.Layers {
			// Test layer name
			assert.NotEmpty(t, layer.LayerName, "Layer should have a name")
			
			// Test layer ARN
			assert.NotEmpty(t, layer.LayerArn, "Layer should have an ARN")
			
			// Test latest version
			assert.NotNil(t, layer.LatestMatchingVersion, "Layer should have a latest version")
		}
	})

	suite.Logger.Info().Msg("Lambda infrastructure tests completed")
}

// TestECS tests ECS infrastructure
func (suite *AWSTestSuite) TestECS(t *testing.T) {
	suite.Logger.Info().Msg("Testing ECS infrastructure")

	// Test ECS Clusters
	t.Run("Clusters", func(t *testing.T) {
		clusters, err := suite.ECS.ListClusters(&ecs.ListClustersInput{})
		require.NoError(t, err)

		if len(clusters.ClusterArns) > 0 {
			clusterDetails, err := suite.ECS.DescribeClusters(&ecs.DescribeClustersInput{
				Clusters: clusters.ClusterArns,
			})
			require.NoError(t, err)

			// Test cluster configuration
			for _, cluster := range clusterDetails.Clusters {
				// Test cluster name
				assert.NotEmpty(t, cluster.ClusterName, "Cluster should have a name")
				
				// Test status
				assert.Equal(t, "ACTIVE", *cluster.Status, "Cluster should be active")
				
				// Test capacity providers
				suite.Logger.Info().Str("cluster", *cluster.ClusterName).
					Int("capacity_providers", len(cluster.CapacityProviders)).
					Msg("Cluster capacity providers")
			}
		}
	})

	// Test ECS Services
	t.Run("Services", func(t *testing.T) {
		clusters, err := suite.ECS.ListClusters(&ecs.ListClustersInput{})
		require.NoError(t, err)

		for _, clusterArn := range clusters.ClusterArns {
			services, err := suite.ECS.ListServices(&ecs.ListServicesInput{
				Cluster: clusterArn,
			})
			require.NoError(t, err)

			if len(services.ServiceArns) > 0 {
				serviceDetails, err := suite.ECS.DescribeServices(&ecs.DescribeServicesInput{
					Cluster:  clusterArn,
					Services: services.ServiceArns,
				})
				require.NoError(t, err)

				// Test service configuration
				for _, service := range serviceDetails.Services {
					// Test service name
					assert.NotEmpty(t, service.ServiceName, "Service should have a name")
					
					// Test status
					assert.Equal(t, "ACTIVE", *service.Status, "Service should be active")
					
					// Test task definition
					assert.NotEmpty(t, service.TaskDefinition, "Service should have a task definition")
					
					// Test desired count
					assert.True(t, *service.DesiredCount >= 0, "Service should have a desired count")
				}
			}
		}
	})

	// Test ECS Task Definitions
	t.Run("Task Definitions", func(t *testing.T) {
		taskDefs, err := suite.ECS.ListTaskDefinitions(&ecs.ListTaskDefinitionsInput{})
		require.NoError(t, err)

		if len(taskDefs.TaskDefinitionArns) > 0 {
			// Get first 10 task definitions
			arns := taskDefs.TaskDefinitionArns
			if len(arns) > 10 {
				arns = arns[:10]
			}

			taskDefDetails, err := suite.ECS.DescribeTaskDefinition(&ecs.DescribeTaskDefinitionInput{
				TaskDefinition: arns[0],
			})
			require.NoError(t, err)

			// Test task definition configuration
			taskDef := taskDefDetails.TaskDefinition
			
			// Test family
			assert.NotEmpty(t, taskDef.Family, "Task definition should have a family")
			
			// Test revision
			assert.True(t, *taskDef.Revision > 0, "Task definition should have a revision")
			
			// Test container definitions
			assert.True(t, len(taskDef.ContainerDefinitions) > 0, "Task definition should have container definitions")
			
			// Test network mode
			assert.NotEmpty(t, taskDef.NetworkMode, "Task definition should have a network mode")
		}
	})

	suite.Logger.Info().Msg("ECS infrastructure tests completed")
}

// TestEKS tests EKS infrastructure
func (suite *AWSTestSuite) TestEKS(t *testing.T) {
	suite.Logger.Info().Msg("Testing EKS infrastructure")

	// Test EKS Clusters
	t.Run("Clusters", func(t *testing.T) {
		clusters, err := suite.EKS.ListClusters(&eks.ListClustersInput{})
		require.NoError(t, err)

		// Test cluster configuration
		for _, clusterName := range clusters.Clusters {
			cluster, err := suite.EKS.DescribeCluster(&eks.DescribeClusterInput{
				Name: clusterName,
			})
			require.NoError(t, err)

			// Test cluster name
			assert.NotEmpty(t, cluster.Cluster.Name, "Cluster should have a name")
			
			// Test status
			assert.Equal(t, "ACTIVE", *cluster.Cluster.Status, "Cluster should be active")
			
			// Test version
			assert.NotEmpty(t, cluster.Cluster.Version, "Cluster should have a version")
			
			// Test endpoint
			assert.NotEmpty(t, cluster.Cluster.Endpoint, "Cluster should have an endpoint")
			
			// Test VPC config
			assert.NotNil(t, cluster.Cluster.ResourcesVpcConfig, "Cluster should have VPC config")
			
			// Test subnets
			assert.True(t, len(cluster.Cluster.ResourcesVpcConfig.SubnetIds) > 0, 
				"Cluster should have subnets")
		}
	})

	// Test EKS Node Groups
	t.Run("Node Groups", func(t *testing.T) {
		clusters, err := suite.EKS.ListClusters(&eks.ListClustersInput{})
		require.NoError(t, err)

		for _, clusterName := range clusters.Clusters {
			nodeGroups, err := suite.EKS.ListNodegroups(&eks.ListNodegroupsInput{
				ClusterName: clusterName,
			})
			require.NoError(t, err)

			// Test node group configuration
			for _, nodeGroupName := range nodeGroups.Nodegroups {
				nodeGroup, err := suite.EKS.DescribeNodegroup(&eks.DescribeNodegroupInput{
					ClusterName:   clusterName,
					NodegroupName: nodeGroupName,
				})
				require.NoError(t, err)

				// Test node group name
				assert.NotEmpty(t, nodeGroup.Nodegroup.NodegroupName, "Node group should have a name")
				
				// Test status
				assert.Equal(t, "ACTIVE", *nodeGroup.Nodegroup.Status, "Node group should be active")
				
				// Test instance types
				assert.True(t, len(nodeGroup.Nodegroup.InstanceTypes) > 0, 
					"Node group should have instance types")
				
				// Test scaling config
				assert.NotNil(t, nodeGroup.Nodegroup.ScalingConfig, "Node group should have scaling config")
				
				// Test subnets
				assert.True(t, len(nodeGroup.Nodegroup.Subnets) > 0, 
					"Node group should have subnets")
			}
		}
	})

	suite.Logger.Info().Msg("EKS infrastructure tests completed")
}

// TestSecurity tests security infrastructure
func (suite *AWSTestSuite) TestSecurity(t *testing.T) {
	suite.Logger.Info().Msg("Testing security infrastructure")

	// Test KMS Keys
	t.Run("KMS Keys", func(t *testing.T) {
		keys, err := suite.KMS.ListKeys(&kms.ListKeysInput{})
		require.NoError(t, err)

		// Test key configuration
		for _, key := range keys.Keys {
			keyDetails, err := suite.KMS.DescribeKey(&kms.DescribeKeyInput{
				KeyId: key.KeyId,
			})
			require.NoError(t, err)

			// Test key state
			assert.Equal(t, "Enabled", *keyDetails.KeyMetadata.KeyState, "Key should be enabled")
			
			// Test key usage
			assert.Contains(t, []string{"ENCRYPT_DECRYPT", "SIGN_VERIFY"}, 
				*keyDetails.KeyMetadata.KeyUsage, "Key should have valid usage")
			
			// Test key spec
			assert.NotEmpty(t, keyDetails.KeyMetadata.KeySpec, "Key should have a key spec")
		}
	})

	// Test Secrets Manager
	t.Run("Secrets", func(t *testing.T) {
		secrets, err := suite.SecretsManager.ListSecrets(&secretsmanager.ListSecretsInput{})
		require.NoError(t, err)

		// Test secret configuration
		for _, secret := range secrets.SecretList {
			// Test secret name
			assert.NotEmpty(t, secret.Name, "Secret should have a name")
			
			// Test ARN
			assert.NotEmpty(t, secret.ARN, "Secret should have an ARN")
			
			// Test creation date
			assert.NotNil(t, secret.CreatedDate, "Secret should have a creation date")
			
			// Test description
			if secret.Description != nil {
				assert.NotEmpty(t, *secret.Description, "Secret description should not be empty")
			}
		}
	})

	// Test WAF
	t.Run("WAF", func(t *testing.T) {
		webACLs, err := suite.WAF.ListWebACLs(&wafv2.ListWebACLsInput{
			Scope: aws.String("REGIONAL"),
		})
		require.NoError(t, err)

		// Test WAF configuration
		for _, webACL := range webACLs.WebACLs {
			// Test name
			assert.NotEmpty(t, webACL.Name, "Web ACL should have a name")
			
			// Test ARN
			assert.NotEmpty(t, webACL.ARN, "Web ACL should have an ARN")
			
			// Test description
			if webACL.Description != nil {
				assert.NotEmpty(t, *webACL.Description, "Web ACL description should not be empty")
			}
		}
	})

	// Test GuardDuty
	t.Run("GuardDuty", func(t *testing.T) {
		detectors, err := suite.GuardDuty.ListDetectors(&guardduty.ListDetectorsInput{})
		require.NoError(t, err)

		// Test detector configuration
		for _, detectorId := range detectors.DetectorIds {
			detector, err := suite.GuardDuty.GetDetector(&guardduty.GetDetectorInput{
				DetectorId: detectorId,
			})
			require.NoError(t, err)

			// Test status
			assert.Equal(t, "ENABLED", *detector.Status, "GuardDuty detector should be enabled")
			
			// Test service role
			assert.NotEmpty(t, detector.ServiceRole, "Detector should have a service role")
		}
	})

	// Test Security Hub
	t.Run("Security Hub", func(t *testing.T) {
		_, err := suite.SecurityHub.GetEnabledStandards(&securityhub.GetEnabledStandardsInput{})
		if err != nil {
			suite.Logger.Warn().Msg("Security Hub not enabled or not accessible")
		} else {
			suite.Logger.Info().Msg("Security Hub is enabled")
		}
	})

	suite.Logger.Info().Msg("Security infrastructure tests completed")
}

// TestMonitoring tests monitoring infrastructure
func (suite *AWSTestSuite) TestMonitoring(t *testing.T) {
	suite.Logger.Info().Msg("Testing monitoring infrastructure")

	// Test CloudWatch Alarms
	t.Run("CloudWatch Alarms", func(t *testing.T) {
		alarms, err := suite.CloudWatch.DescribeAlarms(&cloudwatch.DescribeAlarmsInput{})
		require.NoError(t, err)

		// Test alarm configuration
		for _, alarm := range alarms.MetricAlarms {
			// Test alarm name
			assert.NotEmpty(t, alarm.AlarmName, "Alarm should have a name")
			
			// Test metric name
			assert.NotEmpty(t, alarm.MetricName, "Alarm should have a metric name")
			
			// Test namespace
			assert.NotEmpty(t, alarm.Namespace, "Alarm should have a namespace")
			
			// Test comparison operator
			assert.NotEmpty(t, alarm.ComparisonOperator, "Alarm should have a comparison operator")
			
			// Test threshold
			assert.NotNil(t, alarm.Threshold, "Alarm should have a threshold")
			
			// Test evaluation periods
			assert.True(t, *alarm.EvaluationPeriods > 0, "Alarm should have evaluation periods")
		}
	})

	// Test CloudWatch Logs
	t.Run("CloudWatch Logs", func(t *testing.T) {
		logGroups, err := suite.CloudWatch.DescribeLogGroups(&cloudwatch.DescribeLogGroupsInput{})
		require.NoError(t, err)

		// Test log group configuration
		for _, logGroup := range logGroups.LogGroups {
			// Test log group name
			assert.NotEmpty(t, logGroup.LogGroupName, "Log group should have a name")
			
			// Test creation time
			assert.NotNil(t, logGroup.CreationTime, "Log group should have a creation time")
			
			// Test retention policy
			if logGroup.RetentionInDays != nil {
				assert.True(t, *logGroup.RetentionInDays > 0, "Log group should have retention days")
			}
		}
	})

	// Test X-Ray
	t.Run("X-Ray", func(t *testing.T) {
		_, err := suite.XRay.GetServiceGraph(&xray.GetServiceGraphInput{
			StartTime: aws.Time(time.Now().Add(-1 * time.Hour)),
			EndTime:   aws.Time(time.Now()),
		})
		if err != nil {
			suite.Logger.Warn().Msg("X-Ray not configured or no data available")
		} else {
			suite.Logger.Info().Msg("X-Ray is configured")
		}
	})

	suite.Logger.Info().Msg("Monitoring infrastructure tests completed")
}

// TestBackup tests backup infrastructure
func (suite *AWSTestSuite) TestBackup(t *testing.T) {
	suite.Logger.Info().Msg("Testing backup infrastructure")

	// Test Backup Vaults
	t.Run("Backup Vaults", func(t *testing.T) {
		vaults, err := suite.Backup.ListBackupVaults(&backup.ListBackupVaultsInput{})
		require.NoError(t, err)

		// Test vault configuration
		for _, vault := range vaults.BackupVaultList {
			// Test vault name
			assert.NotEmpty(t, vault.BackupVaultName, "Backup vault should have a name")
			
			// Test vault ARN
			assert.NotEmpty(t, vault.BackupVaultArn, "Backup vault should have an ARN")
			
			// Test creation date
			assert.NotNil(t, vault.CreationDate, "Backup vault should have a creation date")
			
			// Test encryption key
			if vault.EncryptionKeyArn != nil {
				assert.NotEmpty(t, *vault.EncryptionKeyArn, "Encryption key ARN should not be empty")
			}
		}
	})

	// Test Backup Plans
	t.Run("Backup Plans", func(t *testing.T) {
		plans, err := suite.Backup.ListBackupPlans(&backup.ListBackupPlansInput{})
		require.NoError(t, err)

		// Test plan configuration
		for _, plan := range plans.BackupPlansList {
			// Test plan name
			assert.NotEmpty(t, plan.BackupPlanName, "Backup plan should have a name")
			
			// Test plan ARN
			assert.NotEmpty(t, plan.BackupPlanArn, "Backup plan should have an ARN")
			
			// Test creation date
			assert.NotNil(t, plan.CreationDate, "Backup plan should have a creation date")
			
			// Test version
			assert.NotEmpty(t, plan.VersionId, "Backup plan should have a version")
		}
	})

	suite.Logger.Info().Msg("Backup infrastructure tests completed")
}

// TestCost tests cost management
func (suite *AWSTestSuite) TestCost(t *testing.T) {
	suite.Logger.Info().Msg("Testing cost management")

	// Test Cost Explorer
	t.Run("Cost Explorer", func(t *testing.T) {
		endDate := time.Now()
		startDate := endDate.AddDate(0, -1, 0)

		costs, err := suite.CostExplorer.GetCostAndUsage(&costexplorer.GetCostAndUsageInput{
			TimePeriod: &costexplorer.DateInterval{
				Start: aws.String(startDate.Format("2006-01-02")),
				End:   aws.String(endDate.Format("2006-01-02")),
			},
			Granularity: aws.String("MONTHLY"),
			Metrics:     []*string{aws.String("BlendedCost")},
		})
		require.NoError(t, err)

		// Test cost data
		assert.True(t, len(costs.ResultsByTime) > 0, "Should have cost data")
		
		for _, result := range costs.ResultsByTime {
			suite.Logger.Info().
				Str("start", *result.TimePeriod.Start).
				Str("end", *result.TimePeriod.End).
				Str("cost", *result.Total["BlendedCost"].Amount).
				Msg("Cost data")
		}
	})

	// Test Budgets
	t.Run("Budgets", func(t *testing.T) {
		budgets, err := suite.Budgets.DescribeBudgets(&budgets.DescribeBudgetsInput{
			AccountId: aws.String("123456789012"), // This would be your actual account ID
		})
		
		// Budget access might be restricted
		if err != nil {
			suite.Logger.Warn().Err(err).Msg("Unable to access budgets")
		} else {
			// Test budget configuration
			for _, budget := range budgets.Budgets {
				// Test budget name
				assert.NotEmpty(t, budget.BudgetName, "Budget should have a name")
				
				// Test budget limit
				assert.NotNil(t, budget.BudgetLimit, "Budget should have a limit")
				
				// Test time unit
				assert.NotEmpty(t, budget.TimeUnit, "Budget should have a time unit")
			}
		}
	})

	suite.Logger.Info().Msg("Cost management tests completed")
}

// TestCompliance tests compliance
func (suite *AWSTestSuite) TestCompliance(t *testing.T) {
	suite.Logger.Info().Msg("Testing compliance")

	// Test Config Rules
	t.Run("Config Rules", func(t *testing.T) {
		rules, err := suite.Config.DescribeConfigRules(&config.DescribeConfigRulesInput{})
		require.NoError(t, err)

		// Test rule configuration
		for _, rule := range rules.ConfigRules {
			// Test rule name
			assert.NotEmpty(t, rule.ConfigRuleName, "Config rule should have a name")
			
			// Test rule state
			assert.Equal(t, "ACTIVE", *rule.ConfigRuleState, "Config rule should be active")
			
			// Test source
			assert.NotNil(t, rule.Source, "Config rule should have a source")
		}
	})

	// Test CloudTrail
	t.Run("CloudTrail", func(t *testing.T) {
		trails, err := suite.CloudTrail.DescribeTrails(&cloudtrail.DescribeTrailsInput{})
		require.NoError(t, err)

		// Test trail configuration
		for _, trail := range trails.TrailList {
			// Test trail name
			assert.NotEmpty(t, trail.Name, "Trail should have a name")
			
			// Test S3 bucket
			assert.NotEmpty(t, trail.S3BucketName, "Trail should have an S3 bucket")
			
			// Test home region
			assert.NotEmpty(t, trail.HomeRegion, "Trail should have a home region")
		}
	})

	suite.Logger.Info().Msg("Compliance tests completed")
}

// TestPerformance tests performance
func (suite *AWSTestSuite) TestPerformance(t *testing.T) {
	suite.Logger.Info().Msg("Testing performance")

	// Test Auto Scaling
	t.Run("Auto Scaling", func(t *testing.T) {
		groups, err := suite.AutoScaling.DescribeAutoScalingGroups(&autoscaling.DescribeAutoScalingGroupsInput{})
		require.NoError(t, err)

		// Test auto scaling group configuration
		for _, group := range groups.AutoScalingGroups {
			// Test group name
			assert.NotEmpty(t, group.AutoScalingGroupName, "Auto scaling group should have a name")
			
			// Test min size
			assert.True(t, *group.MinSize >= 0, "Min size should be non-negative")
			
			// Test max size
			assert.True(t, *group.MaxSize >= *group.MinSize, "Max size should be >= min size")
			
			// Test desired capacity
			assert.True(t, *group.DesiredCapacity >= *group.MinSize && 
				*group.DesiredCapacity <= *group.MaxSize, "Desired capacity should be within bounds")
			
			// Test availability zones
			assert.True(t, len(group.AvailabilityZones) > 0, "Auto scaling group should have availability zones")
		}
	})

	suite.Logger.Info().Msg("Performance tests completed")
}

// TestDisasterRecovery tests disaster recovery
func (suite *AWSTestSuite) TestDisasterRecovery(t *testing.T) {
	suite.Logger.Info().Msg("Testing disaster recovery")

	// Test Multi-AZ deployments
	t.Run("Multi-AZ Deployments", func(t *testing.T) {
		// Test RDS Multi-AZ
		instances, err := suite.RDS.DescribeDBInstances(&rds.DescribeDBInstancesInput{})
		require.NoError(t, err)

		for _, instance := range instances.DBInstances {
			if instance.MultiAZ != nil && *instance.MultiAZ {
				suite.Logger.Info().Str("instance", *instance.DBInstanceIdentifier).
					Msg("RDS instance is Multi-AZ")
			}
		}
	})

	// Test Cross-Region Replication
	t.Run("Cross-Region Replication", func(t *testing.T) {
		// Test S3 Cross-Region Replication
		buckets, err := suite.S3.ListBuckets(&s3.ListBucketsInput{})
		require.NoError(t, err)

		for _, bucket := range buckets.Buckets {
			_, err := suite.S3.GetBucketReplication(&s3.GetBucketReplicationInput{
				Bucket: bucket.Name,
			})
			if err == nil {
				suite.Logger.Info().Str("bucket", *bucket.Name).
					Msg("S3 bucket has cross-region replication")
			}
		}
	})

	suite.Logger.Info().Msg("Disaster recovery tests completed")
}

// TestChaosEngineering tests chaos engineering
func (suite *AWSTestSuite) TestChaosEngineering(t *testing.T) {
	suite.Logger.Info().Msg("Testing chaos engineering")

	// Test Fault Injection Simulator
	t.Run("Fault Injection Simulator", func(t *testing.T) {
		// This would test AWS FIS if it's configured
		suite.Logger.Info().Msg("Chaos engineering tests would be implemented here")
	})

	suite.Logger.Info().Msg("Chaos engineering tests completed")
}

// Helper methods for health checks and connectivity tests
func (suite *AWSTestSuite) TestDatabaseHealth(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing database health")
	// Implementation would test actual database connectivity
	return nil
}

func (suite *AWSTestSuite) TestCacheHealth(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing cache health")
	// Implementation would test actual cache connectivity
	return nil
}

func (suite *AWSTestSuite) TestLoadBalancerHealth(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing load balancer health")
	// Implementation would test actual load balancer connectivity
	return nil
}

func (suite *AWSTestSuite) TestContainerServiceHealth(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing container service health")
	// Implementation would test actual container service connectivity
	return nil
}

func (suite *AWSTestSuite) TestHTTPConnectivity(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing HTTP connectivity")
	// Implementation would test actual HTTP connectivity using http-helper
	return nil
}

func (suite *AWSTestSuite) TestInternalConnectivity(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing internal connectivity")
	// Implementation would test actual internal connectivity
	return nil
}

func (suite *AWSTestSuite) TestSSLConfiguration(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing SSL configuration")
	// Implementation would test SSL/TLS configuration
	return nil
}

func (suite *AWSTestSuite) TestNetworkSecurity(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing network security")
	// Implementation would test network security rules
	return nil
}

func (suite *AWSTestSuite) TestAccessControls(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing access controls")
	// Implementation would test access control policies
	return nil
}

func (suite *AWSTestSuite) TestEncryption(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing encryption")
	// Implementation would test encryption configuration
	return nil
}

func (suite *AWSTestSuite) TestLoadPerformance(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing load performance")
	// Implementation would run load performance tests
	return nil
}

func (suite *AWSTestSuite) TestStressPerformance(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing stress performance")
	// Implementation would run stress performance tests
	return nil
}

func (suite *AWSTestSuite) TestEndurancePerformance(outputs map[string]interface{}) error {
	suite.Logger.Info().Msg("Testing endurance performance")
	// Implementation would run endurance performance tests
	return nil
}

func (suite *AWSTestSuite) TestDatabaseBackup(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing database backup")
	// Implementation would test database backup functionality
	return nil
}

func (suite *AWSTestSuite) TestStorageBackup(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing storage backup")
	// Implementation would test storage backup functionality
	return nil
}

func (suite *AWSTestSuite) TestMonitoringEndpoint(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing monitoring endpoint")
	// Implementation would test monitoring endpoint
	return nil
}

func (suite *AWSTestSuite) TestAlertingEndpoint(endpoint string) error {
	suite.Logger.Info().Str("endpoint", endpoint).Msg("Testing alerting endpoint")
	// Implementation would test alerting endpoint
	return nil
}