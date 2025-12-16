# SendGrid Configuration

## 🔑 Get Your API Key

1. Go to https://app.sendgrid.com/
2. Sign up for a free account (100 emails/day forever)
3. Navigate to **Settings** → **API Keys**
4. Click **Create API Key**
5. Name it "emobility-referrals"
6. Select **Full Access** (or **Restricted Access** with Mail Send permission)
7. Copy the API key (you'll only see it once!)

## ⚙️ Setup

Add to your `.env.local` file:

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
APP_URL=http://localhost:3002
```

**Important**: 
- For `FROM_EMAIL`, use a verified sender email or domain in SendGrid
- To verify a sender: Settings → Sender Authentication → Verify Single Sender
- For production, set up domain authentication

## 📧 Send Referral Email

```powershell
$env:MGM_SERVICE_ACCOUNT_PATH="D:\secrets\emobility-service-firebase-adminsdk-fbsvc-d06db60748.json"
$env:SENDGRID_API_KEY="your-sendgrid-api-key-here"
$env:REFERRAL_CODE="ABC12345"
$env:FRIEND_EMAIL="friend@example.com"
$env:FROM_EMAIL="noreply@yourdomain.com"
npm run referral:email
```

## 📝 Email Template Features

The professional HTML email includes:
- 🎁 Attractive gradient header
- 📝 Personalized message from referring member
- 💳 Prominent referral code display
- 💰 Discount offer highlight
- 🔗 Registration button with tracking
- 📱 Mobile-responsive design
- 🎨 Branded color scheme

## 🧪 Testing

### Test with Temporary Email
Use a service like:
- https://temp-mail.org/
- https://10minutemail.com/

### Check Email Delivery
1. SendGrid Dashboard → Activity Feed
2. See delivery status, opens, clicks
3. Debug any issues

## 🚀 Production Setup

1. **Verify Domain**
   - Settings → Sender Authentication → Authenticate Your Domain
   - Add DNS records to your domain
   - Improves deliverability

2. **Email Templates**
   - Create dynamic templates in SendGrid
   - Use template IDs in code
   - A/B test different designs

3. **Unsubscribe Management**
   - Add unsubscribe links (required for marketing)
   - Track opt-outs

## 💡 Free Tier Limits

- **100 emails/day** (permanent)
- 2,000 contacts storage
- 1 sender identity
- Basic email analytics

Upgrade for:
- More emails
- Advanced analytics
- API rate increases
- Dedicated IPs
