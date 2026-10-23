import { LocationCode } from "@prisma/client";
import { Transform, TransformFnParams } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";

const BOOLEAN_QUERY_VALUES: Readonly<Record<string, boolean>> = { true: true, false: false };

const parsedBoolean = ({ value }: TransformFnParams): unknown =>
  typeof value === "string" && value in BOOLEAN_QUERY_VALUES ? BOOLEAN_QUERY_VALUES[value] : value;

export class QueryRoomsDto {
  @IsOptional()
  @IsEnum(LocationCode)
  readonly locationCode?: LocationCode;

  @IsOptional()
  @Transform(parsedBoolean)
  @IsBoolean()
  readonly active?: boolean;
}
