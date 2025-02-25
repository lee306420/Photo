let photos = [];  // 改为让它成为可修改的变量
let dataManager; // 声明在全局作用域
let photoViewer;
let photoImporter;
let photoSearch;

function groupPhotosByDate(photos) {
    return photos.reduce((groups, photo) => {
        const date = new Date(photo.date);
        const dateKey = date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(photo);
        return groups;
    }, {});
}

const PhotoViewer = require('./components/PhotoViewer');
const PhotoImporter = require('./utils/PhotoImporter');
const PhotoSearch = require('./utils/PhotoSearch');
const DataManager = require('./utils/DataManager');
const { dialog, shell } = require('@electron/remote');

// 处理照片导入完成的回调
async function handleImportComplete(newPhotos) {
    photos.push(...newPhotos);
    await dataManager.savePhotoData(photos);
    renderPhotos(photos);
    updateDateTree();
}

// 更新路径显示
function updatePathDisplay() {
    const pathElement = document.querySelector('#current-path');
    pathElement.textContent = dataManager.getDataPath();
}

// 初始化应用
async function initializeApp() {
    try {
        // 初始化数据管理器
        dataManager = new DataManager();
        await dataManager.initializeDataPath();  // 等待初始化完成
        
        // 初始化组件
        photoViewer = new PhotoViewer();
        photoImporter = new PhotoImporter(handleImportComplete, dataManager);
        photoSearch = new PhotoSearch(photos);

        // 加载已保存的照片
        try {
            const savedPhotos = await dataManager.loadPhotoData();
            if (savedPhotos && savedPhotos.length > 0) {
                photos = savedPhotos;
                renderPhotos(photos);
            }
        } catch (error) {
            console.error('加载照片失败:', error);
        }

        // 初始化后显示当前路径
        updatePathDisplay();

        // 添加各种事件监听器...
        setupEventListeners();

        updateDateTree();
    } catch (error) {
        console.error('应用初始化失败:', error);
    }
}

// 将事件监听器设置分离出来
function setupEventListeners() {
    document.querySelector('#import-btn').addEventListener('click', () => {
        photoImporter.importPhotos();
    });

    document.querySelector('#settings-btn').addEventListener('click', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: '选择照片库存储位置'
        });

        if (!result.canceled) {
            try {
                await dataManager.setDataPath(result.filePaths[0]);
                updatePathDisplay();
                photos = await dataManager.loadPhotoData();
                renderPhotos(photos);
            } catch (error) {
                console.error('设置存储路径失败:', error);
            }
        }
    });

    document.querySelector('#open-path-btn').addEventListener('click', () => {
        const currentPath = dataManager.getDataPath();
        shell.openPath(currentPath).catch(err => {
            console.error('打开文件夹失败:', err);
        });
    });

    document.querySelector('#search-input').addEventListener('input', (e) => {
        const searchResults = photoSearch.search(e.target.value);
        renderPhotos(searchResults);
    });
}

// 在 DOMContentLoaded 时初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);

// 添加手势支持
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;
    if (Math.abs(swipeDistance) > 50) {
        if (swipeDistance > 0) {
            photoViewer.showPrevious();
        } else {
            photoViewer.showNext();
        }
    }
}

// 更新渲染函数，添加年月分类
function renderPhotos(photosToRender = photos) {
    const dateView = document.querySelector('.date-view');
    dateView.innerHTML = '';
    
    // 按日期分组并排序
    const groupedByYear = groupPhotosByYearMonthDay(photosToRender);
    
    // 渲染年份分组
    Object.entries(groupedByYear).sort((a, b) => b[0] - a[0]).forEach(([year, months]) => {
        const yearGroup = document.createElement('div');
        yearGroup.className = 'year-group';
        
        // 创建年份标题
        const yearHeader = document.createElement('div');
        yearHeader.className = 'year-header';
        yearHeader.innerHTML = `
            <h2>${year}年</h2>
            <span class="photo-count">${countPhotosInYear(months)}个项目</span>
        `;
        yearGroup.appendChild(yearHeader);
        
        // 渲染月份分组
        Object.entries(months).sort((a, b) => b[0] - a[0]).forEach(([month, days]) => {
            const monthGroup = document.createElement('div');
            monthGroup.className = 'month-group';
            
            // 创建月份标题
            const monthHeader = document.createElement('div');
            monthHeader.className = 'month-header';
            monthHeader.innerHTML = `
                <h3>${month}月</h3>
                <span class="photo-count">${countPhotosInMonth(days)}个项目</span>
            `;
            monthGroup.appendChild(monthHeader);
            
            // 渲染日期分组
            Object.entries(days).sort((a, b) => b[0] - a[0]).forEach(([day, dayPhotos]) => {
                const dateGroup = createDateGroup(day, dayPhotos);
                monthGroup.appendChild(dateGroup);
            });
            
            yearGroup.appendChild(monthGroup);
        });
        
        dateView.appendChild(yearGroup);
    });
}

// 按年月日分组照片
function groupPhotosByYearMonthDay(photos) {
    return photos.reduce((groups, photo) => {
        const date = new Date(photo.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        if (!groups[year]) groups[year] = {};
        if (!groups[year][month]) groups[year][month] = {};
        if (!groups[year][month][day]) groups[year][month][day] = [];
        
        groups[year][month][day].push(photo);
        return groups;
    }, {});
}

// 计算年份内的照片总数
function countPhotosInYear(months) {
    return Object.values(months).reduce((total, days) => {
        return total + countPhotosInMonth(days);
    }, 0);
}

// 计算月份内的照片总数
function countPhotosInMonth(days) {
    return Object.values(days).reduce((total, photos) => {
        return total + photos.length;
    }, 0);
}

// 创建日期组
function createDateGroup(day, photos) {
    const dateGroup = document.createElement('div');
    dateGroup.className = 'date-group';
    
    const dateHeader = document.createElement('div');
    dateHeader.className = 'date-header';
    
    const dateText = document.createElement('h4');
    dateText.textContent = `${day}日 (${photos.length}张)`;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.innerHTML = `
        <i class="fas fa-chevron-down"></i>
        <span>展开</span>
    `;
    
    dateHeader.appendChild(dateText);
    dateHeader.appendChild(toggleBtn);
    
    const photoGrid = document.createElement('div');
    photoGrid.className = 'photo-grid';
    
    // 创建主要照片容器
    if (photos.length > 0) {
        const mainPhoto = document.createElement('div');
        mainPhoto.className = 'main-photo';
        mainPhoto.appendChild(createPhotoItem(photos[0], day));
        photoGrid.appendChild(mainPhoto);
    }
    
    // 创建其余照片的容器
    if (photos.length > 1) {
        const remainingPhotos = document.createElement('div');
        remainingPhotos.className = 'remaining-photos';
        // 显式设置初始状态为 none
        remainingPhotos.style.display = 'none';
        
        // 添加剩余的照片
        photos.slice(1).forEach(photo => {
            remainingPhotos.appendChild(createPhotoItem(photo, day));
        });
        
        photoGrid.appendChild(remainingPhotos);
        
        // 添加展开/收起功能
        toggleBtn.addEventListener('click', function(e) {
            const currentGroup = e.currentTarget.closest('.date-group');
            const remainingSection = currentGroup.querySelector('.remaining-photos');
            const icon = e.currentTarget.querySelector('i');
            const span = e.currentTarget.querySelector('span');
            
            if (remainingSection.style.display === 'none') {
                remainingSection.style.display = 'grid';
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
                span.textContent = '收起';
            } else {
                remainingSection.style.display = 'none';
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
                span.textContent = '展开';
            }
        });
    } else {
        // 如果只有一张照片，隐藏展开按钮
        toggleBtn.style.display = 'none';
    }
    
    dateGroup.appendChild(dateHeader);
    dateGroup.appendChild(photoGrid);
    return dateGroup;
}

// 创建单个照片项
function createPhotoItem(file, date) {
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    
    const img = document.createElement('img');
    img.src = file.thumbnail || file.path;
    img.alt = `Photo from ${date}`;
    
    // 添加媒体类型标识
    if (file.type === 'video') {
        const videoIndicator = document.createElement('div');
        videoIndicator.className = 'media-indicator video';
        videoIndicator.innerHTML = '<i class="fas fa-play"></i>';
        photoItem.appendChild(videoIndicator);
    }
    
    photoItem.onclick = () => {
        photoViewer.show(file, photos);
    };
    
    photoItem.appendChild(img);
    return photoItem;
}

function updateDateTree(photosToRender = photos) {
    const treeContent = document.querySelector('.tree-content');
    treeContent.innerHTML = '';
    
    const groupedByYear = groupPhotosByYearMonth(photosToRender);
    
    Object.entries(groupedByYear).sort((a, b) => b[0] - a[0]).forEach(([year, monthsData]) => {
        const yearNode = document.createElement('div');
        yearNode.className = 'year-node';
        yearNode.innerHTML = `
            <span>
                <i class="fas fa-chevron-right"></i>
                ${year}年
            </span>
            <span class="date-count">${countPhotosInYearData(monthsData)}个项目</span>
        `;
        
        const monthList = document.createElement('div');
        monthList.className = 'month-list';
        
        Object.entries(monthsData).sort((a, b) => b[0] - a[0]).forEach(([month, monthPhotos]) => {
            const monthNode = document.createElement('div');
            monthNode.className = 'month-node';
            monthNode.innerHTML = `
                <span>${month}月</span>
                <span class="date-count">${monthPhotos.length}个项目</span>
            `;
            
            monthNode.addEventListener('click', (e) => {
                e.stopPropagation();
                // 清除其他选中状态
                document.querySelectorAll('.month-node').forEach(node => {
                    node.classList.remove('active');
                });
                monthNode.classList.add('active');
                
                // 过滤并显示选中月份的照片
                const filteredPhotos = photos.filter(photo => {
                    const date = new Date(photo.date);
                    return date.getFullYear() === parseInt(year) && 
                           (date.getMonth() + 1) === parseInt(month);
                });
                
                renderPhotos(filteredPhotos);
            });
            
            monthList.appendChild(monthNode);
        });
        
        // 添加年份点击事件
        yearNode.addEventListener('click', (e) => {
            if (!e.target.closest('.month-node')) {  // 确保不是点击月份节点
                const icon = yearNode.querySelector('i');
                icon.classList.toggle('fa-chevron-down');
                icon.classList.toggle('fa-chevron-right');
                monthList.classList.toggle('expanded');
                
                // 显示该年份的所有照片
                const filteredPhotos = photos.filter(photo => {
                    const date = new Date(photo.date);
                    return date.getFullYear() === parseInt(year);
                });
                renderPhotos(filteredPhotos);
            }
        });
        
        treeContent.appendChild(yearNode);
        treeContent.appendChild(monthList);
    });
}

// 辅助函数：计算年份数据中的照片总数
function countPhotosInYearData(monthsData) {
    return Object.values(monthsData).reduce((total, photos) => {
        return total + photos.length;
    }, 0);
}

// 按年月分组照片
function groupPhotosByYearMonth(photos) {
    return photos.reduce((groups, photo) => {
        const date = new Date(photo.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        if (!groups[year]) groups[year] = {};
        if (!groups[year][month]) groups[year][month] = [];
        
        groups[year][month].push(photo);
        return groups;
    }, {});
} 