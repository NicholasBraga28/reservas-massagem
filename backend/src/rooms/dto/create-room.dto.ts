import { Transform, TransformFnParams } from "class-transformer";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

const trimmed = ({ value }: TransformFnParams): unknown => (typeof value === "string" ? value.trim() : value);

export class CreateRoomDto {
  @Transform(trimmed)
  @IsString()
  @IsNotEmpty()
  readonly name!: string;

  @IsUUID()
  readonly locationId!: string;
}
