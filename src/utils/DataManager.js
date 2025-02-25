const { app } = require('@electron/remote');
const path = require('path');
const fs = require('fs').promises;

class DataManager {
    constructor() {
        this.configPath = path.join(app.getPath('userData'), 'config.json');
        this.initializeDataPath();
    }

    // 修改为异步读取配置
    async readConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // 如果文件不存在，返回默认配置
            const defaultConfig = {
                dataPath: path.join(app.getPath('pictures'), 'ElectronPhotos')
            };
            // 保存默认配置
            await this.saveConfig(defaultConfig);
            return defaultConfig;
        }
    }

    // 修改为异步初始化
    async initializeDataPath() {
        try {
            const config = await this.readConfig();
            this.dataPath = config.dataPath;
            
            // 设置数据库路径
            this.dbPath = path.join(this.dataPath, 'db');
            
            // 确保基本目录存在
            await fs.mkdir(this.dataPath, { recursive: true });
            await fs.mkdir(this.dbPath, { recursive: true });
            
            return this.dataPath;
        } catch (error) {
            console.error('初始化数据路径失败:', error);
            throw error;
        }
    }

    // 保存配置
    async saveConfig(config) {
        await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    }

    async setDataPath(newPath) {
        // 保存新路径到配置
        const config = await this.readConfig();
        config.dataPath = newPath;
        await this.saveConfig(config);
        
        // 更新路径
        const oldDataPath = this.dataPath;
        this.dataPath = newPath;
        this.dbPath = path.join(newPath, 'db');

        // 创建新目录
        await fs.mkdir(this.dataPath, { recursive: true });
        await fs.mkdir(this.dbPath, { recursive: true });

        // 如果有旧数据，迁移到新位置
        if (oldDataPath && oldDataPath !== newPath) {
            await this.migrateData(oldDataPath);
        }
    }

    async migrateData(oldPath) {
        try {
            // 复制所有数据到新位置
            await this.copyDirectory(oldPath, this.dataPath);
            // 删除旧数据
            await fs.rm(oldPath, { recursive: true, force: true });
        } catch (error) {
            console.error('数据迁移失败:', error);
            throw error;
        }
    }

    async copyDirectory(src, dest) {
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await fs.mkdir(destPath, { recursive: true });
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    getDataPath() {
        return this.dataPath;
    }

    getDbPath() {
        return this.dbPath;
    }

    // 保存照片数据到数据库
    async savePhotoData(photos) {
        const dbFile = path.join(this.dbPath, 'photos.json');
        // 确保数据库目录存在
        await fs.mkdir(path.dirname(dbFile), { recursive: true });
        await fs.writeFile(dbFile, JSON.stringify(photos, null, 2));
    }

    // 读取照片数据
    async loadPhotoData() {
        const dbFile = path.join(this.dbPath, 'photos.json');
        try {
            const data = await fs.readFile(dbFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            // 如果文件不存在或读取失败，返回空数组
            if (error.code === 'ENOENT') {
                return [];
            }
            console.error('读取照片数据失败:', error);
            return [];
        }
    }
}

module.exports = DataManager; 