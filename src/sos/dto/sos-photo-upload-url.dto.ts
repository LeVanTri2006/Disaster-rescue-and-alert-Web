import { IsIn, IsString } from 'class-validator';

export class SosPhotoUploadUrlDto {
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;
}
