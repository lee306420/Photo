const { dialog } = require('@electron/remote');
const fs = require('fs').promises;
const path = require('path');
const ExifReader = require('exif-reader');
const sharp = require('sharp'); // 添加 sharp 用于生成缩略图
const heicConvert = require('heic-convert');
const ffmpeg = require('fluent-ffmpeg');

class PhotoImporter {
    constructor(onImportComplete, dataManager) {
        this.onImportComplete = onImportComplete;
        this.dataManager = dataManager;
        this.supportedFormats = [
            // 图片格式
            '.jpg', '.jpeg', '.png', '.gif', '.heic', '.HEIC',
            // 视频格式
            '.mp4', '.mov', '.avi', '.mkv', '.m4v'
        ];
    }

    async importPhotos() {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openFile', 'multiSelections'],
                filters: [
                    { 
                        name: '媒体文件',
                        extensions: [
                            'jpg', 'jpeg', 'png', 'gif', 'heic', 'HEIC',
                            'mp4', 'mov', 'avi', 'mkv', 'm4v'
                        ]
                    }
                ]
            });

            console.log('文件选择结果:', result);  // 添加调试日志

            if (!result.canceled) {
                const importedFiles = await this.processFiles(result.filePaths);
                console.log('导入的照片:', importedFiles);  // 添加调试日志
                await this.dataManager.savePhotoData(importedFiles);
                this.onImportComplete(importedFiles);
            }
        } catch (error) {
            console.error('导入文件时发生错误:', error);
        }
    }

    async processFiles(filePaths) {
        const files = [];
        for (const filePath of filePaths) {
            try {
                const stats = await fs.stat(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.m4v'].includes(ext);

                let processedBuffer = null;
                let newExt = ext;
                let metadata = null;
                let fileDate = stats.mtime;

                if (isVideo) {
                    // 处理视频
                    metadata = await this.extractVideoMetadata(filePath);
                    fileDate = metadata.creationDate || stats.mtime;
                } else {
                    // 处理图片
                    const fileBuffer = await fs.readFile(filePath);
                    if (ext === '.heic') {
                        processedBuffer = await this.convertHeicToJpeg(fileBuffer);
                        newExt = '.jpg';
                    } else {
                        processedBuffer = fileBuffer;
                    }
                    metadata = await this.extractMetadata(processedBuffer);
                    fileDate = this.getPhotoDate(metadata, stats.mtime);
                }

                // 创建日期文件夹路径
                const dateFolderPath = await this.createDateFolderPath(fileDate);
                
                // 生成新的文件名和路径
                const baseName = path.basename(filePath, ext);
                const newFileName = `${Date.now()}-${baseName}${newExt}`;
                const newFilePath = path.join(dateFolderPath, newFileName);

                // 生成缩略图
                const thumbnailName = `thumb-${Date.now()}-${baseName}.jpg`;
                const thumbnailPath = path.join(dateFolderPath, 'thumbnails', thumbnailName);
                await this.ensureDir(path.dirname(thumbnailPath));

                if (isVideo) {
                    // 复制视频文件
                    await fs.copyFile(filePath, newFilePath);
                    // 生成视频缩略图
                    await this.generateVideoThumbnail(filePath, thumbnailPath);
                } else {
                    // 保存处理后的图片
                    await fs.writeFile(newFilePath, processedBuffer || fileBuffer);
                    // 生成图片缩略图
                    await this.generateThumbnail(processedBuffer || fileBuffer, thumbnailPath);
                }

                files.push({
                    id: Date.now() + Math.random(),
                    path: newFilePath,
                    name: path.basename(filePath),
                    date: fileDate,
                    metadata: metadata,
                    thumbnail: thumbnailPath,
                    originalFormat: ext,
                    type: isVideo ? 'video' : 'image',
                    duration: isVideo ? metadata.duration : null
                });
            } catch (error) {
                console.error(`处理文件失败: ${filePath}`, error);
            }
        }
        return files;
    }

    async createDateFolderPath(date) {
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            
            const yearPath = path.join(this.dataManager.getDataPath(), year.toString());
            const monthPath = path.join(yearPath, month);
            const dayPath = path.join(monthPath, day);
            
            // 确保所有层级的文件夹都存在
            await this.ensureDir(yearPath);
            await this.ensureDir(monthPath);
            await this.ensureDir(dayPath);
            await this.ensureDir(path.join(dayPath, 'thumbnails'));
            
            return dayPath;
        } catch (error) {
            console.error('创建日期文件夹失败:', error);
            throw error;
        }
    }

    async ensureDir(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            try {
                await fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
                console.error(`创建目录失败: ${dirPath}`, error);
                throw error;
            }
        }
    }

    async generateThumbnail(buffer, targetPath) {
        try {
            // 获取图片元数据
            const metadata = await sharp(buffer).metadata();
            
            // 创建 Sharp 实例
            let sharpInstance = sharp(buffer);
            
            // 根据 orientation 手动处理旋转
            switch (metadata.orientation) {
                case 3:
                    sharpInstance = sharpInstance.rotate(180);
                    break;
                case 6:
                    sharpInstance = sharpInstance.rotate(90);
                    break;
                case 8:
                    sharpInstance = sharpInstance.rotate(270);
                    break;
            }

            // 生成缩略图
            await sharpInstance
                .resize(300, 300, {
                    fit: 'cover',
                    position: 'centre'
                })
                .withMetadata({ orientation: 1 }) // 重置方向信息
                .toFile(targetPath);
        } catch (error) {
            console.error('生成缩略图失败:', error);
            throw error;
        }
    }

    async extractMetadata(buffer) {
        try {
            // 使用 sharp 读取图片元数据
            const metadata = await sharp(buffer).metadata();
            
            if (metadata.exif) {
                // 使用 exif-reader 解析 EXIF 数据
                const exifData = ExifReader(metadata.exif);
                
                return {
                    make: exifData.Make?.value,
                    model: exifData.Model?.value,
                    dateTaken: exifData.DateTimeOriginal?.value,
                    width: metadata.width,
                    height: metadata.height,
                    iso: exifData.ISOSpeedRatings?.value,
                    exposureTime: exifData.ExposureTime?.value,
                    fNumber: exifData.FNumber?.value,
                    focalLength: exifData.FocalLength?.value,
                    gps: this.extractGPS(exifData)
                };
            }
            
            // 如果没有 EXIF 数据，至少返回图片尺寸
            return {
                width: metadata.width,
                height: metadata.height
            };
        } catch (error) {
            console.error('读取元数据失败:', error);
            return null;
        }
    }

    extractGPS(exifData) {
        if (!exifData.GPSLatitude || !exifData.GPSLongitude) {
            return null;
        }

        try {
            const lat = this.convertDMSToDD(
                exifData.GPSLatitude.value,
                exifData.GPSLatitudeRef?.value
            );
            const lng = this.convertDMSToDD(
                exifData.GPSLongitude.value,
                exifData.GPSLongitudeRef?.value
            );

            return { lat, lng };
        } catch (error) {
            console.error('GPS数据解析失败:', error);
            return null;
        }
    }

    convertDMSToDD(dms, ref) {
        const degrees = dms[0];
        const minutes = dms[1];
        const seconds = dms[2];
        
        let dd = degrees + minutes / 60 + seconds / 3600;
        if (ref === 'S' || ref === 'W') {
            dd = -dd;
        }
        
        return dd;
    }

    getPhotoDate(metadata, fallbackDate) {
        if (metadata?.dateTaken) {
            try {
                // 处理可能的日期格式
                const date = new Date(metadata.dateTaken);
                if (!isNaN(date.getTime())) {
                    return date;
                }
            } catch (error) {
                console.error('解析拍摄日期失败:', error);
            }
        }
        return fallbackDate;
    }

    async convertHeicToJpeg(buffer) {
        try {
            // 转换 HEIC 为 JPEG
            const jpegBuffer = await heicConvert({
                buffer: buffer,
                format: 'JPEG',
                quality: 1
            });
            return jpegBuffer;
        } catch (error) {
            console.error('HEIC 转换失败:', error);
            throw error;
        }
    }

    // 新增：提取视频元数据
    extractVideoMetadata(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) return reject(err);
                
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                resolve({
                    width: videoStream?.width,
                    height: videoStream?.height,
                    duration: metadata.format.duration,
                    creationDate: metadata.format.tags?.creation_time 
                        ? new Date(metadata.format.tags.creation_time)
                        : null,
                    bitrate: metadata.format.bit_rate,
                    format: metadata.format.format_name
                });
            });
        });
    }

    // 新增：生成视频缩略图
    generateVideoThumbnail(videoPath, thumbnailPath) {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: ['00:00:01'],
                    filename: path.basename(thumbnailPath),
                    folder: path.dirname(thumbnailPath),
                    size: '300x300'
                })
                .on('end', async () => {
                    try {
                        // 读取生成的缩略图并处理旋转
                        const thumbnailBuffer = await fs.readFile(thumbnailPath);
                        const metadata = await sharp(thumbnailBuffer).metadata();
                        
                        let sharpInstance = sharp(thumbnailBuffer);
                        
                        // 只根据 orientation 进行旋转调整
                        switch (metadata.orientation) {
                            case 3:
                                sharpInstance = sharpInstance.rotate(180);
                                break;
                            case 6:
                                sharpInstance = sharpInstance.rotate(90);
                                break;
                            case 8:
                                sharpInstance = sharpInstance.rotate(270);
                                break;
                        }

                        await sharpInstance
                            .withMetadata({ orientation: 1 })
                            .toFile(thumbnailPath + '.tmp');
                        
                        // 替换原缩略图
                        await fs.unlink(thumbnailPath);
                        await fs.rename(thumbnailPath + '.tmp', thumbnailPath);
                        resolve();
                    } catch (error) {
                        console.error('处理视频缩略图失败:', error);
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }
}

module.exports = PhotoImporter; 