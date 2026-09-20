# Preflight — AWS Deployment Instructions for Account Holder

This document contains everything needed to deploy the application on AWS. You do not need to install dependencies or run build commands.

---

## 1. Deploy Frontend to AWS Amplify Hosting (~2 minutes) · PRIORITY

The complete static frontend is pre-packaged at the root of this repository in `preflight-amplify.zip`.

1. Log in to the [AWS Management Console](https://console.aws.amazon.com/).
2. Navigate to **AWS Amplify**.
3. In the left navigation, click **All apps** → click **Create new app** (or **Deploy an app**).
4. Choose **Deploy without Git provider** and click **Next**.
5. Configure:
   - **App name**: `preflight-poa`
   - **Environment name**: `production` (or `main`)
   - **Method**: Drag-and-drop the file `preflight-amplify.zip` from this repository.
6. Click **Save and deploy**.
7. Wait ~90 seconds for Amplify to provision the distribution and SSL certificate.
8. Copy the generated live HTTPS URL (e.g. `https://main.d12345abcdefg.amplifyapp.com`).
9. **Send this live URL back immediately** so it can be added to `README.md` and the hackathon submission form.

---

## 2. Optional: Deploy AWS Lambda + Amazon Bedrock (~10 minutes)

The app is 100% functional without this step. Only attempt this if the Amplify deployment in Step 1 is finished and live.

1. Navigate to **AWS Lambda** in the AWS Console (ensure you are in an AWS region with Bedrock model access, such as `us-east-1` or `us-west-2`).
2. Click **Create function**:
   - **Function name**: `preflight-bedrock-opinion`
   - **Runtime**: `Python 3.12`
   - **Architecture**: `x86_64` (or `arm64`)
3. In the code editor, replace the default code with the contents of [`lambda_function.py`](./lambda_function.py) from this repository. Click **Deploy**.
4. Configure **Function URL**:
   - Go to **Configuration** → **Function URL** → click **Create Function URL**.
   - **Auth type**: `NONE`
   - Check **Configure cross-origin resource sharing (CORS)**:
     - **Allow origin**: `*` (or paste your Amplify URL from Step 1)
     - **Allow headers**: `content-type`
     - **Allow methods**: `POST, OPTIONS`
   - Click **Save**. Copy the generated Function URL.
5. Attach **Bedrock Permissions**:
   - Go to **Configuration** → **Permissions** → click on the Execution Role name to open IAM.
   - Click **Add permissions** → **Attach policies**.
   - Attach `AmazonBedrockFullAccess` (or an inline policy granting `bedrock:InvokeModel` and `bedrock:Converse`).
6. Set Model ID (if needed):
   - In `lambda_function.py`, the default model is `anthropic.claude-3-haiku-20240307-v1:0` or Amazon Titan/Nova. Ensure model access is enabled in the Bedrock Console (**Bedrock** → **Model access**).

### Important Bedrock Warning

> **a fresh account often has every Bedrock quota at 0, and returns `ThrottlingException` rather than an access error. If you see throttling on the first call, it is almost certainly missing model access, not rate limiting. Do not spend more than 15 minutes on this — the app is complete without it.**

---

## 3. What to Send Back

Once completed, please send back:
1. **Amplify Live URL** (e.g. `https://main.dXXXXXXXX.amplifyapp.com`) — *Mandatory for Ship It track*
2. **Lambda Function URL** (if configured)
3. **AWS Account ID** (for the hackathon submission form)
