import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CryptoPairingCodeSource, PAIRING_CODE_SOURCE } from "./pairing-code-source";
import { PairingCodesController } from "./pairing-codes.controller";
import { PairingCodesService } from "./pairing-codes.service";

@Module({
  imports: [PrismaModule],
  controllers: [PairingCodesController],
  providers: [PairingCodesService, { provide: PAIRING_CODE_SOURCE, useClass: CryptoPairingCodeSource }],
})
export class AlexaModule {}
