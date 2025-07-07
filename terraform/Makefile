# ==============================================================================
# Learning Assistant - Terraform Makefile
# ==============================================================================
# This Makefile provides convenient commands for managing the Terraform
# infrastructure for the Learning Assistant application on Google Cloud Platform
# ==============================================================================

.PHONY: help init plan apply destroy clean fmt validate check docs deploy dev staging prod

# Default environment
ENV ?= production

# Colors
GREEN  := \033[32m
YELLOW := \033[33m
RED    := \033[31m
BLUE   := \033[34m
RESET  := \033[0m

# Default target
.DEFAULT_GOAL := help

# ==============================================================================
# HELP AND DOCUMENTATION
# ==============================================================================

help: ## Show this help message
	@echo "$(BLUE)==============================================================================$(RESET)"
	@echo "$(BLUE)  Learning Assistant - Terraform Commands$(RESET)"
	@echo "$(BLUE)==============================================================================$(RESET)"
	@echo ""
	@echo "$(YELLOW)Usage:$(RESET) make [target] [ENV=environment]"
	@echo ""
	@echo "$(YELLOW)Available targets:$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Environment options:$(RESET)"
	@echo "  $(GREEN)development$(RESET)  - Development environment"
	@echo "  $(GREEN)staging$(RESET)      - Staging environment"
	@echo "  $(GREEN)production$(RESET)   - Production environment (default)"
	@echo ""
	@echo "$(YELLOW)Examples:$(RESET)"
	@echo "  make plan                    # Plan production deployment"
	@echo "  make apply ENV=staging       # Apply staging deployment"
	@echo "  make deploy ENV=development  # Full development deployment"
	@echo "  make destroy ENV=staging     # Destroy staging infrastructure"
	@echo ""

# ==============================================================================
# VALIDATION AND SETUP
# ==============================================================================

check-env: ## Check if terraform.tfvars exists
	@if [ ! -f terraform.tfvars ]; then \
		echo "$(RED)Error: terraform.tfvars not found$(RESET)"; \
		echo "$(YELLOW)Copy terraform.tfvars.example and customize it:$(RESET)"; \
		echo "  cp terraform.tfvars.example terraform.tfvars"; \
		echo "  vi terraform.tfvars"; \
		exit 1; \
	fi

check-gcloud: ## Check if gcloud is authenticated
	@if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then \
		echo "$(RED)Error: Not authenticated with Google Cloud$(RESET)"; \
		echo "$(YELLOW)Run:$(RESET) gcloud auth login"; \
		exit 1; \
	fi

prerequisites: check-gcloud check-env ## Check all prerequisites
	@echo "$(GREEN)✓ Prerequisites check passed$(RESET)"

# ==============================================================================
# TERRAFORM OPERATIONS
# ==============================================================================

init: prerequisites ## Initialize Terraform
	@echo "$(YELLOW)Initializing Terraform...$(RESET)"
	terraform init
	@echo "$(GREEN)✓ Terraform initialized$(RESET)"

fmt: ## Format Terraform files
	@echo "$(YELLOW)Formatting Terraform files...$(RESET)"
	terraform fmt -recursive
	@echo "$(GREEN)✓ Formatting completed$(RESET)"

validate: init ## Validate Terraform configuration
	@echo "$(YELLOW)Validating Terraform configuration...$(RESET)"
	terraform validate
	@echo "$(GREEN)✓ Validation passed$(RESET)"

plan: validate ## Plan Terraform deployment
	@echo "$(YELLOW)Planning Terraform deployment for $(ENV)...$(RESET)"
	terraform plan -var="environment=$(ENV)"
	@echo "$(GREEN)✓ Planning completed$(RESET)"

apply: validate ## Apply Terraform configuration
	@echo "$(YELLOW)Applying Terraform configuration for $(ENV)...$(RESET)"
	terraform apply -var="environment=$(ENV)"
	@echo "$(GREEN)✓ Apply completed$(RESET)"

apply-auto: validate ## Apply Terraform configuration without confirmation
	@echo "$(YELLOW)Auto-applying Terraform configuration for $(ENV)...$(RESET)"
	terraform apply -auto-approve -var="environment=$(ENV)"
	@echo "$(GREEN)✓ Auto-apply completed$(RESET)"

destroy: ## Destroy Terraform infrastructure
	@echo "$(RED)WARNING: This will destroy all infrastructure for $(ENV)!$(RESET)"
	@read -p "Are you sure? Type 'yes' to continue: " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		echo "$(YELLOW)Destroying infrastructure...$(RESET)"; \
		terraform destroy -var="environment=$(ENV)"; \
		echo "$(GREEN)✓ Destruction completed$(RESET)"; \
	else \
		echo "$(YELLOW)Destruction cancelled$(RESET)"; \
	fi

# ==============================================================================
# DOCKER OPERATIONS
# ==============================================================================

docker-build: ## Build Docker image
	@echo "$(YELLOW)Building Docker image...$(RESET)"
	cd .. && docker build -t learning-assistant:latest .
	@echo "$(GREEN)✓ Docker image built$(RESET)"

docker-push: ## Push Docker image to GCR
	@echo "$(YELLOW)Pushing Docker image to GCR...$(RESET)"
	@PROJECT_ID=$$(grep "^project_id" terraform.tfvars | sed 's/.*=\s*"\(.*\)".*/\1/'); \
	docker tag learning-assistant:latest gcr.io/$$PROJECT_ID/learning-assistant:latest; \
	gcloud auth configure-docker --quiet; \
	docker push gcr.io/$$PROJECT_ID/learning-assistant:latest
	@echo "$(GREEN)✓ Docker image pushed$(RESET)"

# ==============================================================================
# ENVIRONMENT-SPECIFIC SHORTCUTS
# ==============================================================================

dev: ## Deploy to development environment
	@$(MAKE) deploy ENV=development

staging: ## Deploy to staging environment
	@$(MAKE) deploy ENV=staging

prod: ## Deploy to production environment
	@$(MAKE) deploy ENV=production

# ==============================================================================
# COMPLETE DEPLOYMENT
# ==============================================================================

deploy: ## Complete deployment (build, push, apply)
	@echo "$(BLUE)==============================================================================$(RESET)"
	@echo "$(BLUE)  Starting complete deployment for $(ENV)$(RESET)"
	@echo "$(BLUE)==============================================================================$(RESET)"
	@$(MAKE) docker-build
	@$(MAKE) docker-push
	@$(MAKE) apply ENV=$(ENV)
	@$(MAKE) outputs
	@echo "$(GREEN)🎉 Deployment completed successfully!$(RESET)"

deploy-auto: ## Complete deployment with auto-approval
	@echo "$(BLUE)==============================================================================$(RESET)"
	@echo "$(BLUE)  Starting auto deployment for $(ENV)$(RESET)"
	@echo "$(BLUE)==============================================================================$(RESET)"
	@$(MAKE) docker-build
	@$(MAKE) docker-push
	@$(MAKE) apply-auto ENV=$(ENV)
	@$(MAKE) outputs
	@echo "$(GREEN)🎉 Auto deployment completed successfully!$(RESET)"

# ==============================================================================
# INFORMATION AND MONITORING
# ==============================================================================

outputs: ## Show Terraform outputs
	@echo "$(YELLOW)Terraform Outputs:$(RESET)"
	terraform output

status: ## Show deployment status
	@echo "$(YELLOW)Deployment Status for $(ENV):$(RESET)"
	@terraform output -json | jq -r '.deployment_information.value | to_entries[] | "\(.key): \(.value)"' 2>/dev/null || echo "Status not available"

logs: ## Show Cloud Run logs
	@SERVICE_NAME=$$(terraform output -raw cloud_run_service_name 2>/dev/null); \
	REGION=$$(terraform output -raw region 2>/dev/null); \
	if [ ! -z "$$SERVICE_NAME" ] && [ ! -z "$$REGION" ]; then \
		echo "$(YELLOW)Showing logs for $$SERVICE_NAME in $$REGION...$(RESET)"; \
		gcloud run services logs tail $$SERVICE_NAME --region=$$REGION; \
	else \
		echo "$(RED)Service not found or not deployed$(RESET)"; \
	fi

connect-db: ## Connect to Cloud SQL database
	@DB_INSTANCE=$$(terraform output -raw database_instance_name 2>/dev/null); \
	DB_USER=$$(terraform output -raw database_username 2>/dev/null); \
	if [ ! -z "$$DB_INSTANCE" ] && [ ! -z "$$DB_USER" ]; then \
		echo "$(YELLOW)Connecting to database $$DB_INSTANCE as $$DB_USER...$(RESET)"; \
		gcloud sql connect $$DB_INSTANCE --user=$$DB_USER; \
	else \
		echo "$(RED)Database not found or not deployed$(RESET)"; \
	fi

secrets: ## List Secret Manager secrets
	@PROJECT_ID=$$(terraform output -raw project_id 2>/dev/null); \
	if [ ! -z "$$PROJECT_ID" ]; then \
		echo "$(YELLOW)Secrets for project $$PROJECT_ID:$(RESET)"; \
		gcloud secrets list --project=$$PROJECT_ID --filter="name:learning-assistant*"; \
	else \
		echo "$(RED)Project ID not found$(RESET)"; \
	fi

# ==============================================================================
# MAINTENANCE AND CLEANUP
# ==============================================================================

clean: ## Clean up temporary files
	@echo "$(YELLOW)Cleaning up temporary files...$(RESET)"
	rm -f *.tfplan
	rm -f *.backup
	rm -f crash.log
	@echo "$(GREEN)✓ Cleanup completed$(RESET)"

refresh: ## Refresh Terraform state
	@echo "$(YELLOW)Refreshing Terraform state...$(RESET)"
	terraform refresh -var="environment=$(ENV)"
	@echo "$(GREEN)✓ State refreshed$(RESET)"

show: ## Show Terraform state
	terraform show

state-list: ## List all resources in state
	terraform state list

# ==============================================================================
# COST AND COMPLIANCE
# ==============================================================================

cost-estimate: ## Show estimated costs (requires terraform cloud)
	@echo "$(YELLOW)Cost estimation requires Terraform Cloud integration$(RESET)"
	@echo "$(YELLOW)Estimated monthly costs:$(RESET)"
	@terraform output -raw estimated_monthly_costs 2>/dev/null || echo "Cost information not available"

security-check: ## Show security features
	@echo "$(YELLOW)Security Features:$(RESET)"
	@terraform output -json security_features 2>/dev/null | jq -r 'to_entries[] | "\(.key): \(.value)"' || echo "Security information not available"

# ==============================================================================
# BACKUP AND RECOVERY
# ==============================================================================

backup-db: ## Create database backup
	@DB_INSTANCE=$$(terraform output -raw database_instance_name 2>/dev/null); \
	if [ ! -z "$$DB_INSTANCE" ]; then \
		BACKUP_ID="manual-backup-$$(date +%Y%m%d-%H%M%S)"; \
		echo "$(YELLOW)Creating backup $$BACKUP_ID for $$DB_INSTANCE...$(RESET)"; \
		gcloud sql backups create --instance=$$DB_INSTANCE --description="Manual backup via Makefile"; \
		echo "$(GREEN)✓ Backup created$(RESET)"; \
	else \
		echo "$(RED)Database instance not found$(RESET)"; \
	fi

list-backups: ## List database backups
	@DB_INSTANCE=$$(terraform output -raw database_instance_name 2>/dev/null); \
	if [ ! -z "$$DB_INSTANCE" ]; then \
		echo "$(YELLOW)Backups for $$DB_INSTANCE:$(RESET)"; \
		gcloud sql backups list --instance=$$DB_INSTANCE; \
	else \
		echo "$(RED)Database instance not found$(RESET)"; \
	fi

# ==============================================================================
# UTILITY TARGETS
# ==============================================================================

version: ## Show tool versions
	@echo "$(YELLOW)Tool Versions:$(RESET)"
	@echo "Terraform: $$(terraform version | head -n 1)"
	@echo "Google Cloud SDK: $$(gcloud version | head -n 1)"
	@echo "Docker: $$(docker --version)"

docs: ## Generate documentation
	@echo "$(YELLOW)Generating Terraform documentation...$(RESET)"
	@if command -v terraform-docs >/dev/null 2>&1; then \
		terraform-docs markdown table . > TERRAFORM_DOCS.md; \
		echo "$(GREEN)✓ Documentation generated in TERRAFORM_DOCS.md$(RESET)"; \
	else \
		echo "$(RED)terraform-docs not installed. Install with: brew install terraform-docs$(RESET)"; \
	fi

# ==============================================================================
# DEVELOPMENT SHORTCUTS
# ==============================================================================

quick-deploy: docker-build docker-push apply-auto outputs ## Quick deployment with auto-approval

full-deploy: fmt validate deploy ## Full deployment with validation

update-app: docker-build docker-push apply ## Update just the application