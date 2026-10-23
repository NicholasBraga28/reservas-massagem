import { INestApplication, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { PrismaExceptionFilter } from "./common/prisma-exception.filter";
import { InvalidStatusTransitionFilter } from "./common/filters/invalid-status-transition.filter";

const MAX_REQUEST_ID_LENGTH = 100;

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    (
      request: { headers: Record<string, string | string[] | undefined>; id?: string },
      response: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      const incoming = request.headers["x-request-id"];
      const requestId =
        typeof incoming === "string" && incoming.length <= MAX_REQUEST_ID_LENGTH ? incoming : randomUUID();
      request.id = requestId;
      response.setHeader("x-request-id", requestId);
      next();
    },
  );
  const origins = (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new PrismaExceptionFilter(), new InvalidStatusTransitionFilter());
}
