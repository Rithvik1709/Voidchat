# 🚀 Supabase Storage - Quick Reference Card

## 📋 5-Minute Setup

```bash
# Step 1: Create Bucket
Dashboard → Storage → Create Bucket
Name: chat-images
Access: PUBLIC ✅

# Step 2: Verify Env Vars (should already exist)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Step 3: Test Locally
npm run dev
# Upload image in chat → Should work!

# Step 4: Deploy
git push origin main
# On your hosting platform, add env vars
# Redeploy

# Step 5: Schedule Cleanup
Use EasyCron / GitHub Actions / Lambda
POST /api/uploads/cleanup
Every 24 hours
```

## 🔧 Configuration

| Setting | File | Line | Value |
|---------|------|------|-------|
| Bucket Name | `app/api/upload/route.ts` | 4 | `chat-images` |
| Max Size | `app/api/upload/route.ts` | 6 | `25 * 1024 * 1024` |
| Retention | `app/api/uploads/cleanup/route.ts` | 4 | `24 * 60 * 60 * 1000` |

## 📊 API Reference

### Upload Image
```
POST /api/upload
Content-Type: multipart/form-data
Body: file=<image>

Response:
{
  "url": "https://...",
  "filename": "1234567890-abc123.jpg",
  "size": 1024000,
  "type": "image/jpeg"
}
```

### Cleanup Old Files
```
POST /api/uploads/cleanup

Response:
{
  "cleaned": 5,
  "timestamp": "2025-03-05T10:30:00.000Z"
}
```

## ✨ Features

- ✅ 25MB file limit
- ✅ Image validation (JPEG, PNG, GIF, WebP, SVG)
- ✅ Auto-cleanup (24 hours)
- ✅ Works everywhere (multi-server, serverless)
- ✅ CDN backed by Cloudflare
- ✅ Production-ready

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Upload fails | Check bucket is PUBLIC and named `chat-images` |
| 403 Forbidden | Make bucket PUBLIC in Supabase dashboard |
| Env var error | Verify `NEXT_PUBLIC_SUPABASE_*` in `.env.local` |
| Images not showing | Check Supabase bucket exists and has images |
| Cleanup not running | Check cron job in EasyCron/GitHub Actions |

## 📱 Storage Limits

| Plan | Storage | Bandwidth | Cost |
|------|---------|-----------|------|
| Free | 1 GB | 2 GB | $0 |
| Pro | 100 GB | 200 GB | $25/mo |

Auto-cleanup = 1 GB ≈ 40 images (plenty for free tier!)

## 🎯 Deployment Platforms

### Vercel
1. Push code
2. Settings → Environment Variables → Add env vars
3. Redeploy

### Railway
1. Add `NEXT_PUBLIC_SUPABASE_*` vars
2. Redeploy

### Self-Hosted
1. Update `.env.production`
2. `npm run build && npm start`

### Docker
1. Env vars in container
2. No file storage needed!

## 📞 Support Links

- **Supabase Docs**: https://supabase.com/docs/guides/storage
- **Dashboard**: https://app.supabase.com
- **Issues**: Check `app/api/upload/route.ts` error logs

## ✅ Checklist Before Go-Live

- [ ] Supabase bucket created (`chat-images`)
- [ ] Bucket set to PUBLIC
- [ ] Environment variables configured
- [ ] Local upload test passed
- [ ] Build succeeds: `npm run build`
- [ ] Code pushed to main branch
- [ ] Deployed to production
- [ ] Production upload test passed
- [ ] Cleanup job scheduled (EasyCron/GitHub Actions)
- [ ] Supabase dashboard monitored

## 🎉 You're Done!

Image sharing is now production-ready with Supabase Storage!

**How users upload**: Click 📸 → Select image → Auto-uploaded to Supabase
**Auto-cleanup**: Every 24 hours, old images deleted automatically
**Storage**: Works on any platform (single server, multi-server, serverless, Docker)

---

**Docs**: 
- Setup: [SUPABASE_STORAGE_SETUP.md](./SUPABASE_STORAGE_SETUP.md)
- Deploy: [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)
