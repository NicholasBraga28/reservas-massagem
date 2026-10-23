import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (error.code === "P2002" || error.code === "P2034") {
      response
        .status(409)
        .json({ statusCode: 409, message: "A operação conflita com um registro existente ou concorrente." });
      return;
    }
    if (error.code === "P2025") {
      response.status(404).json({ statusCode: 404, message: "Registro não encontrado." });
      return;
    }
    response.status(500).json({ statusCode: 500, message: "Erro interno de persistência." });
  }
}
