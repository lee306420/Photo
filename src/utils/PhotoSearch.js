class PhotoSearch {
    constructor(photos) {
        this.photos = photos;
    }

    search(query) {
        query = query.toLowerCase();
        return this.photos.filter(photo => {
            return (
                photo.name.toLowerCase().includes(query) ||
                new Date(photo.date).toLocaleDateString('zh-CN').includes(query) ||
                (photo.metadata && this.searchMetadata(photo.metadata, query))
            );
        });
    }

    searchMetadata(metadata, query) {
        return Object.values(metadata).some(value => 
            String(value).toLowerCase().includes(query)
        );
    }
}

module.exports = PhotoSearch; 