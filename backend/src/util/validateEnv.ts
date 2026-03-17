import { cleanEnv } from "envalid";
import { bool, port, str } from "envalid/dist/validators";

export default cleanEnv(process.env, {
  DATABASE_URL: str(),
  PORT: port(),
  SESSION_SECRET: str(),
  ADMIN_SESSION_SECRET: str(),
  CORS_ORIGIN: str({ default: "" }),
  NODE_ENV: str({ choices: ["development", "production", "test"], default: "development" }),
  // MinIO / S3
  MINIO_ENDPOINT: str({ default: "minio" }),
  MINIO_PORT: port({ default: 9000 }),
  MINIO_ACCESS_KEY: str({ default: "minioadmin" }),
  MINIO_SECRET_KEY: str({ default: "minioadmin" }),
  MINIO_BUCKET: str({ default: "forestmanager-images-dev" }),
  MINIO_PUBLIC_URL: str({ default: "http://localhost:9000" }),
  MINIO_USE_SSL: bool({ default: false }),
});
