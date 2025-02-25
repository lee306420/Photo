class PhotoViewer {
    constructor() {
        this.viewer = document.createElement('div');
        this.viewer.className = 'photo-viewer';
        this.setupViewer();
    }

    setupViewer() {
        this.viewer.innerHTML = `
            <div class="viewer-overlay">
                <div class="viewer-container">
                    <div class="viewer-controls">
                        <div class="video-close-btn">×</div>
                        <button class="open-file-btn">
                            <i class="fas fa-folder-open"></i>
                            <span>打开文件位置</span>
                        </button>
                    </div>
                    <div class="prev-btn">
                        <i class="fas fa-chevron-left"></i><span>上一张</span>
                    </div>
                    <div class="viewer-content">
                        <img src="" alt="Full size photo" style="display: none;">
                        <video src="" controls="true" controlsList="nodownload" style="display: none;"></video>
                    </div>
                    <div class="next-btn">
                        <span>下一张</span><i class="fas fa-chevron-right"></i>
                    </div>
                </div>
                <div class="photo-info">
                    <span class="photo-date"></span>
                    <span class="photo-name"></span>
                    <div class="photo-metadata"></div>
                </div>
            </div>
        `;

        const openFileBtn = this.viewer.querySelector('.open-file-btn');
        openFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentFile) {
                const { shell } = require('@electron/remote');
                shell.showItemInFolder(this.currentFile.path);
            }
        });

        document.body.appendChild(this.viewer);
        this.bindEvents();
    }

    bindEvents() {
        this.viewer.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.classList.contains('video-close-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            } else if (target.closest('.prev-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.showPrevious();
            } else if (target.closest('.next-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.showNext();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.viewer.style.display === 'block') {
                if (e.key === 'ArrowLeft') {
                    this.showPrevious();
                } else if (e.key === 'ArrowRight') {
                    this.showNext();
                } else if (e.key === 'Escape') {
                    this.hide();
                }
            }
        });

        const video = this.viewer.querySelector('video');
        video.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    show(file, files) {
        this.currentFile = file;
        this.files = files;
        this.currentIndex = files.findIndex(f => f.id === file.id);
        
        const img = this.viewer.querySelector('img');
        const video = this.viewer.querySelector('video');
        
        video.pause();
        video.currentTime = 0;
        video.src = '';
        img.src = '';
        
        if (file.type === 'video') {
            img.style.display = 'none';
            video.style.display = 'block';
            video.src = file.path;
            video.load();
        } else {
            video.style.display = 'none';
            img.style.display = 'block';
            img.src = file.path;
        }
        
        this.viewer.querySelector('.photo-date').textContent = 
            new Date(file.date).toLocaleDateString('zh-CN');
        this.viewer.querySelector('.photo-name').textContent = file.name;
        
        const metadataHtml = this.formatMetadata(file);
        this.viewer.querySelector('.photo-metadata').innerHTML = metadataHtml;
        
        this.viewer.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    hide() {
        const video = this.viewer.querySelector('video');
        video.pause();
        video.currentTime = 0;
        video.src = '';
        
        this.viewer.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    showPrevious() {
        if (this.currentIndex > 0) {
            this.show(this.files[this.currentIndex - 1], this.files);
        }
    }

    showNext() {
        if (this.currentIndex < this.files.length - 1) {
            this.show(this.files[this.currentIndex + 1], this.files);
        }
    }

    formatMetadata(file) {
        if (!file.metadata) return '';
        
        const items = [];
        if (file.type === 'video') {
            if (file.metadata.width && file.metadata.height) {
                items.push(`${file.metadata.width} × ${file.metadata.height}`);
            }
            if (file.metadata.duration) {
                const minutes = Math.floor(file.metadata.duration / 60);
                const seconds = Math.floor(file.metadata.duration % 60);
                items.push(`时长: ${minutes}:${seconds.toString().padStart(2, '0')}`);
            }
            if (file.metadata.format) {
                items.push(`格式: ${file.metadata.format}`);
            }
        } else {
            if (file.metadata.make && file.metadata.model) {
                items.push(`${file.metadata.make} ${file.metadata.model}`);
            }
            if (file.metadata.width && file.metadata.height) {
                items.push(`${file.metadata.width} × ${file.metadata.height}`);
            }
            if (file.metadata.iso) {
                items.push(`ISO ${file.metadata.iso}`);
            }
            if (file.metadata.exposureTime) {
                items.push(`快门 ${file.metadata.exposureTime}`);
            }
            if (file.metadata.fNumber) {
                items.push(`光圈 ${file.metadata.fNumber}`);
            }
            if (file.metadata.focalLength) {
                items.push(`焦距 ${file.metadata.focalLength}`);
            }
        }
        
        return items.join(' | ');
    }
}

module.exports = PhotoViewer; 