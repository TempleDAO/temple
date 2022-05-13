VERCEL_ORG_ID=team_3pLeer9YFMZT6OJjCiIRGt87
VERCEL_PROJECT_ID=prj_pvPpxFRrQGITQ0Sflddba8X3RI9r

DEPLOYMENT_URL=$(VERCEL_ORG_ID=team_3pLeer9YFMZT6OJjCiIRGt87 VERCEL_PROJECT_ID=prj_pvPpxFRrQGITQ0Sflddba8X3RI9r vercel -A apps/dapp/vercel.json --scope team_3pLeer9YFMZT6OJjCiIRGt87 --force)
echo "Deployment URL is $DEPLOYMENT_URL"
vercel alias set $DEPLOYMENT_URL core.templedao.link --scope team_3pLeer9YFMZT6OJjCiIRGt87