import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export enum SortChildrenBy {
  Manual = 'manual',
  UpdatedAtDesc = 'updatedAtDesc',
}

export class SortChildrenDto {
  @IsNotEmpty()
  @IsUUID()
  pageId: string;

  @IsEnum(SortChildrenBy)
  sortBy: SortChildrenBy;
}
