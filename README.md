# Bizion — ERP & B2B/B2C Commerce Platform

Bizion is a full-stack, multi-tenant B2B/B2C ERP and dynamic catalog management platform designed for modern businesses. It combines internal operational modules (inventory, orders, invoicing, payments, and accounting) with public-facing customer storefronts and customer portals.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS v4, ExcelJS, Sonner)
- **Backend API**: Node.js, Express, TypeScript (Modular Monolith)
- **Database & ORM**: PostgreSQL with Drizzle ORM
- **Cache**: Redis
- **Reverse Proxy / Gateway**: NGINX
- **DevOps & Infrastructure**:
  - **Containers**: Docker & Docker Compose
  - **CI/CD**: GitHub Actions
  - **Cloud IaC**: Terraform (AWS VPC + EKS)
  - **GitOps Continuous Delivery**: Argo CD
  - **Observability**: Prometheus & Grafana (`kube-prometheus-stack`)

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js >= 20.x
- PostgreSQL running locally (default: `localhost:5432`)
- Redis running locally (default: `localhost:6379`)

### 1. Backend Setup
```bash
cd backend
cp .env.example .env
# Update .env with your local PostgreSQL and Redis credentials
npm install
npm run dev
# API running at http://localhost:3000
```

### 2. Frontend Setup
```bash
cd frontend
cp .env.example .env.local  # if applicable
npm install
npm run dev
# Web app running at http://localhost:5173
```

---

## 🐳 Docker Deployment

### Local Multi-Container Stack
Start all services (PostgreSQL, Redis, Backend, Frontend) with a single command:
```bash
docker compose up -d --build
```
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)
- **Postgres (External Port)**: `localhost:5433`

### Production Docker Compose (with NGINX Gateway)
```bash
cp .env.docker.example .env
# Edit .env with strong production credentials
docker compose -f docker-compose.prod.yml up -d --build
```
- NGINX routes web traffic on port `80` / `443`:
  - `/api/*` -> Backend API
  - `/*` -> Next.js Frontend

---

## ☸️ Cloud Infrastructure & GitOps (Terraform, EKS, Argo CD, Prometheus, Grafana)

```
[ Git Repository ] ---> [ Argo CD Engine ] ---> [ AWS EKS Cluster (bizion) ]
                                                        │
                                                        ├── Backend (2 replicas)
                                                        ├── Frontend (2 replicas)
                                                        ├── PostgreSQL & Redis
                                                        └── Prometheus & Grafana (monitoring)
```

### 1. Provision Infrastructure via Terraform
Automates the provisioning of AWS VPC, EKS Cluster, Argo CD, and the Prometheus/Grafana stack:
```bash
cd terraform
terraform init
terraform plan
terraform apply -auto-approve
```

### 2. Connect `kubectl` to EKS
```bash
aws eks update-kubeconfig --region ap-south-1 --name bizion-eks
```

### 3. Deploy App via Argo CD GitOps
Deploy the Argo CD Application manifest to track the repository:
```bash
kubectl apply -f argocd/application.yaml
```
Argo CD will automatically sync manifests from `k8s/base` into the `bizion` namespace.

- **Retrieve Argo CD Admin Password**:
  ```bash
  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
  ```

### 4. Monitoring (Prometheus & Grafana)
The `kube-prometheus-stack` is installed automatically in the `monitoring` namespace.
- **Apply the Backend ServiceMonitor**:
  ```bash
  kubectl apply -f k8s/monitoring/service-monitor.yaml
  ```
- **Access Grafana**:
  ```bash
  kubectl get svc -n monitoring kube-prometheus-stack-grafana
  ```
  Login with username `admin` and the password configured in `terraform/variables.tf`.

---

## 🔄 CI/CD Pipeline (GitHub Actions)

A GitHub Actions workflow is configured in `.github/workflows/ci-cd.yml`:
1. **Verify**: Runs compile and build checks on both `backend` and `frontend`.
2. **Docker Build**: Validates multi-stage Docker container builds using Docker Buildx.
3. **Continuous Deployment**: Automatically deploys the updated containers via SSH on pushes to `main`.

---

## 📁 Repository Structure

```
bizion/
├── backend/            # Express API modular monolith
├── frontend/           # Next.js 16 app router
├── nginx/              # NGINX gateway reverse proxy configuration
├── terraform/          # AWS VPC, EKS, and Helm infrastructure as code
├── k8s/
│   ├── base/           # Kubernetes manifests (Deployments, Services, Ingress)
│   └── monitoring/     # Prometheus ServiceMonitor resources
├── argocd/             # Argo CD GitOps Application CRD
├── docker-compose.yml  # Local multi-container orchestration
├── docker-compose.prod.yml # Production orchestration with NGINX
└── .github/workflows/  # CI/CD pipelines
```
