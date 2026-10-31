import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function main() {
  const client = new S3Client({
    region: 'auto',
    endpoint: 'https://7ab30522fe0700235b5d8b6e1fa745dc.r2.cloudflarestorage.com',
    credentials: { 
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '', 
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '' 
    },
  });
  const command = new GetObjectCommand({
    Bucket: 'canh-bao-thien-tai',
    Key: 'test-key.jpg',
  });
  const url = await getSignedUrl(client, command, { expiresIn: 3600 });
  console.log("URL:", url);
}
main();
