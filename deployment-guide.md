# Preflight — AWS Deployment Guide for Account Holder

> **A step-by-step guide for deploying Preflight on AWS.**  
> Written specifically for teammates with AWS console access. No complex build tools or local CLI installations required.

---

## 📋 Quick Executive Briefing

- **Deployment Time:** ~2 minutes for frontend (Amplify) · ~8 minutes for optional AI backend (Lambda + Bedrock).
- **AWS Cost:** **$0.00** (100% covered under the AWS Free Tier).
- **Files Needed:** Everything is pre-packaged in this repository. You do not need to run `npm install` or compile anything.
- **Top Priority:** Getting the live **Amplify URL** is the single requirement for the **AWS First Commit "Ship It" Track** (₹2,00,000 prize pool).

---

## ☁️ AWS Services Connected in This Project

Preflight utilizes a serverless, zero-trust cloud architecture:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AWS CLOUD ARCHITECTURE                                │
│                                                                                         │
│   1. AWS Amplify Hosting (Mandatory)                                                    │
│      ├── Hosts static bundle: index.html, landing.html, styles.css, rubric.js, app.js   │
│      ├── Global CDN edge caching (Amazon CloudFront)                                    │
│      └── Automated SSL certificate provisioning (HTTPS)                                 │
│                                                                                         │
│   2. AWS Lambda (Optional AI Second Opinion)                                            │
│      ├── Serverless runtime: Python 3.12                                                │
│      ├── Lambda Function URL (Public HTTPS endpoint, CORS enabled)                      │
│      └── Sanitizes and fences untrusted appeal text inside <poa>DATA</poa> tags         │
│                                                                                         │
│   3. Amazon Bedrock (Optional AI Foundation Model)                                      │
│      ├── Model: Anthropic Claude 3 Haiku / Amazon Titan / Amazon Nova                   │
│      └── Converse API: Evaluates subtle investigator nuance                             │
│                                                                                         │
│   4. AWS IAM (Identity & Access Management)                                             │
│      └── Execution Role granting Lambda permission to invoke Bedrock Converse API       │
│                                                                                         │
│   5. Amazon CloudWatch                                                                  │
│      └── Automated log streaming and execution metrics                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Part 1: Deploy Frontend to AWS Amplify (~90 Seconds)

### Step 1.1: Locate the Deployment Archive
In the root directory of this repository, locate the pre-packaged zip file:
- **`preflight-amplify.zip`** (Size: ~44 KB)
- *(Note: This archive contains `index.html`, `landing.html`, `styles.css`, `rubric.js`, and `app.js` at the root folder).*

### Step 1.2: Deploy via AWS Amplify Console
1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. In the top search bar, type **Amplify** and select **AWS Amplify**.
3. In the left-hand navigation, click **All apps** → click the orange **Create new app** button (or **Deploy an app**).
4. On the deployment options screen, choose:  
   👉 **Deploy without Git provider** (or *Upload existing build artifacts*) and click **Next**.
5. Fill out the application settings:
   - **App name:** `preflight-poa`
   - **Environment name:** `production` (or `main`)
   - **Method:** Select **Drag and drop** and upload `preflight-amplify.zip` from your computer.
6. Click **Save and deploy**.

<p align="center">
  <em>Amplify will automatically extract the files, configure CloudFront CDN edge points, and provision a free SSL certificate.</em>
</p>

7. Wait ~90 seconds until the deployment status turns green (**Deployed**).
8. Copy your live HTTPS URL (it will look like `https://production.d12345abcdefg.amplifyapp.com`).

> [!IMPORTANT]
> **Send this live URL back to the team immediately!** It must be pasted at line 5 of `README.md` and into the hackathon submission portal before the deadline.

---

## 🤖 Part 2: Deploy AWS Lambda + Amazon Bedrock (~8 Minutes, Optional)

The application is 100% functional without this step because the deterministic rubric runs client-side in the browser. Only proceed with Part 2 after Part 1 is live.

### Step 2.1: Check Bedrock Model Access
1. Switch your AWS region to **US East (N. Virginia) `us-east-1`** or **US West (Oregon) `us-west-2`** (regions with the widest Bedrock model availability).
2. Open the [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock/).
3. In the left sidebar, click **Model access**.
4. Check if **Anthropic Claude 3 Haiku** or **Amazon Titan Text G1 - Express** shows as **Access granted**.
5. If not granted, click **Modify model access**, check the box next to Claude 3 Haiku or Titan, and click **Next** → **Submit**.

> [!WARNING]
> Fresh AWS accounts sometimes have Bedrock quotas at 0 and return `ThrottlingException` rather than an access error. If model access takes more than 10 minutes to grant, **stop and skip this step**—the core application does not depend on it.

### Step 2.2: Create the Lambda Function
1. Open the [AWS Lambda Console](https://console.aws.amazon.com/lambda/).
2. Click **Create function**:
   - **Function name:** `preflight-bedrock-opinion`
   - **Runtime:** **Python 3.12**
   - **Architecture:** `x86_64` (or `arm64`)
   - Leave default permissions (Lambda will create a basic execution role).
3. Click **Create function**.

### Step 2.3: Paste the Lambda Code
1. In the **Code source** editor tab, open `lambda_function.py`.
2. Replace all code in the editor with the complete contents of [`lambda_function.py`](lambda_function.py) from this repository.
3. Click **Deploy** (Ctrl+Shift+U).

### Step 2.4: Configure the Function URL with CORS
1. In the Lambda function page, click the **Configuration** tab.
2. In the left menu, select **Function URL** → click **Create Function URL**.
3. Configure the settings:
   - **Auth type:** Select **`NONE`** (public endpoint).
   - Check the box: **Configure cross-origin resource sharing (CORS)**.
   - **Allow origin:** Type `*` (or paste your live Amplify URL from Part 1).
   - **Allow headers:** Type `content-type` (and `authorization`).
   - **Allow methods:** Select **`POST`** and **`OPTIONS`**.
4. Click **Save**.
5. Copy the generated **Function URL** (e.g. `https://abc123xyz.lambda-url.us-east-1.on.aws/`).

### Step 2.5: Attach Bedrock Permissions in IAM
1. Under the **Configuration** tab, click **Permissions** on the left menu.
2. Under **Execution role**, click the blue role name (e.g. `preflight-bedrock-opinion-role-...`) to open AWS IAM.
3. In IAM, click **Add permissions** → **Attach policies**.
4. In the search box, type `AmazonBedrockFullAccess`.
5. Select `AmazonBedrockFullAccess` and click **Add permissions**.

### Step 2.6: Test the AI Integration in Preflight
1. Open your live Amplify web app URL in your browser.
2. In the left column, scroll to the **"Amazon Bedrock Second Opinion"** card.
3. Click **"Inspect Prompt Fencing & Configure Endpoint"**.
4. Paste your Lambda Function URL into the input field.
5. Click **"Get AI Opinion"**. Within 2 seconds, Bedrock will analyze the POA draft and display its nuance review.

---

## 💻 Part 3: AWS CLI Alternative (For Terminal Users)

If you prefer deploying via the AWS CLI, run these commands:

### Deploy to Amplify via CLI
```bash
# 1. Create the Amplify App
aws amplify create-app --name "preflight-poa" --region us-east-1

# 2. Create the production branch
aws amplify create-branch --app-id <YOUR_APP_ID> --branch-name production --region us-east-1

# 3. Deploy preflight-amplify.zip
aws amplify start-deployment \
  --app-id <YOUR_APP_ID> \
  --branch-name production \
  --zip-file-blob fileb://preflight-amplify.zip \
  --region us-east-1
```

### Deploy Lambda via CLI
```bash
# 1. Create IAM execution role
aws iam create-role --role-name preflight-lambda-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# 2. Attach Bedrock and CloudWatch policies
aws iam attach-role-policy --role-name preflight-lambda-role --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws iam attach-role-policy --role-name preflight-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# 3. Create zip for lambda
python -c "import zipfile; zf = zipfile.ZipFile('lambda.zip', 'w'); zf.write('lambda_function.py'); zf.close()"

# 4. Create function
aws lambda create-function \
  --function-name preflight-bedrock-opinion \
  --runtime python3.12 \
  --role arn:aws:iam::<ACCOUNT_ID>:role/preflight-lambda-role \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://lambda.zip \
  --region us-east-1

# 5. Create public Function URL with CORS
aws lambda create-function-url-config \
  --function-name preflight-bedrock-opinion \
  --auth-type NONE \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["POST","OPTIONS"],"AllowHeaders":["content-type"]}' \
  --region us-east-1
```

---

## 🛠️ Part 4: Troubleshooting Matrix

| Issue | Root Cause | Solution |
|---|---|---|
| **Amplify shows 404 Not Found on load** | Zip file was archived with a wrapper subfolder instead of files at root. | Ensure `preflight-amplify.zip` has `index.html` at the archive root. The pre-built zip in this repo is already verified. |
| **Bedrock returns `ThrottlingException`** | Brand new AWS accounts have Bedrock quota initialized at 0. | Confirm model access under **Amazon Bedrock → Model access**. If pending, skip Bedrock; the app works 100% without it. |
| **Lambda returns 403 Forbidden** | Function URL Auth type was set to `AWS_IAM` instead of `NONE`. | In Lambda, go to **Configuration → Function URL**, edit configuration, and set **Auth type** to `NONE`. |
| **Browser console shows CORS error** | Lambda Function URL is missing CORS configuration headers. | In Lambda, go to **Configuration → Function URL → Edit CORS**, add `*` to **Allow origin** and select `POST, OPTIONS`. |
| **Bedrock returns `AccessDeniedException`** | Lambda execution role does not have Bedrock invocation permissions. | In IAM, attach the `AmazonBedrockFullAccess` managed policy to the Lambda execution role. |

---

## ✅ Part 5: Handoff Checklist

Once finished, copy and message the following details back to your teammate:

```text
[ ] 1. Live Amplify URL:
    https://production.dXXXXXXXXXXXX.amplifyapp.com

[ ] 2. Lambda Function URL (if deployed):
    https://XXXXXXXXXXXX.lambda-url.us-east-1.on.aws/

[ ] 3. AWS Account ID (12-digit number for submission):
    1234-5678-9012

[ ] 4. AWS Region used:
    us-east-1 (N. Virginia)
```

**Congratulations! Your deployment is complete and ready for hackathon submission.**
