/**
 * MathBase - Logic
 * Powered by Fuse.js for fuzzy searching and KaTeX for math rendering.
 */

// Global State
const state = {
    data: null,
    fuse: null,
    currentSubject: null,
    currentChapter: null,
    currentCategory: null,
    activeTool: null,
    matrixA: { rows: 3, cols: 3 },
    matrixB: { rows: 3, cols: 3 },
    searchQuery: "",
    isMobile: window.innerWidth < 992,
    currentResults: [],
    renderedCount: 0,
    pageSize: 10,
    referenceFiles: [
        { name: "Giáo trình 1", filename: "Giaotrinh1.pdf", type: "Giáo trình" },
        { name: "Giáo trình 2", filename: "Giaotrinh2.pdf", type: "Giáo trình" },
        { name: "Tham khảo 1", filename: "Thamkhao1.pdf", type: "Tham khảo" },
        { name: "Tham khảo 2", filename: "Thamkhao2.pdf", type: "Tham khảo" },
        { name: "Tham khảo 3", filename: "Thamkhao3.pdf", type: "Tham khảo" },
        { name: "Tham khảo 4", filename: "Thamkhao4.pdf", type: "Tham khảo" },
        { name: "Giải tích 1 khoa CNTT", filename: "giải tích 1 khoa CNTT.pdf", type: "Bài giảng" },
        { name: "Đại số tuyến tính trọn bộ", filename: "ĐSTT trọn bộ.pdf", type: "Bài giảng" }
    ],
    activeReference: false
};

// DOM Elements
const elements = {
    contentArea: document.getElementById('contentArea'),
    subjectFilters: document.getElementById('subjectFilters'),
    categoryFilters: document.getElementById('categoryFilters'),
    mobileSubjectFilters: document.getElementById('mobileSubjectFilters'),
    mobileCategoryFilters: document.getElementById('mobileCategoryFilters'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    searchStatusArea: document.getElementById('searchStatusArea'),
    searchStatusText: document.getElementById('searchStatusText'),
    searchResultCount: document.getElementById('searchResultCount'),
    homeBreadcrumb: document.getElementById('homeBreadcrumb'),
    subjectBreadcrumb: document.getElementById('subjectBreadcrumb'),
    btnBackToTop: document.getElementById('btnBackToTop'),
    themeToggle: document.getElementById('themeToggle')
};

// Initialization
async function init() {
    // Basic UI logic that doesn't depend on external data
    setupEventListeners();
    initTheme();

    try {
        const response = await fetch('assets/data.json');
        if (!response.ok) throw new Error("Failed to fetch data");
        
        state.data = await response.json();
        
        // Setup Fuse.js for Fuzzy Search
        const fuseOptions = {
            keys: [
                { name: 'title', weight: 0.5 },
                { name: 'tags', weight: 0.3 },
                { name: 'content', weight: 0.2 }
            ],
            threshold: 0.4, // Lower threshold = stricter search. 0.4 is good for typos.
            ignoreLocation: true // Search anywhere in the text
        };
        state.fuse = new Fuse(state.data.topics, fuseOptions);

        renderFilters();
        
        // Initial render: process chunks instead of whole list
        state.currentResults = state.data.topics;
        renderTopicsChunk(true);
        
    } catch (error) {
        if (window.location.protocol === 'file:') {
            elements.contentArea.innerHTML = `
                <div class="alert alert-warning" role="alert">
                    <h4 class="alert-heading"><i class="bi bi-shield-exclamation"></i> Trình duyệt chặn tải dữ liệu (CORS Error)</h4>
                    <p>Bạn đang mở file trực tiếp bằng đường dẫn <code>file:///.../index.html</code>. Các trình duyệt hiện đại (Chrome, Edge) sẽ chặn việc tải file <code>data.json</code> thông qua hàm fetch() vì lý do bảo mật.</p>
                    <hr>
                    <div class="mt-3">
                        <p class="fw-bold mb-2">Cách khắc phục để chạy thử (chọn 1 cách):</p>
                        <ol class="mb-0">
                            <li class="mb-2">Mở thư mục code bằng <b>Visual Studio Code</b> $\\rightarrow$ Cài đặt extension <b>Live Server</b> $\\rightarrow$ Chuột phải vào file <code>index.html</code> chọn <b>Open with Live Server</b>.</li>
                            <li class="mb-2">Mở <b>Terminal/Command Prompt</b> tại thư mục này và gõ lệnh: <code>npx serve</code> hoặc <code>python -m http.server 8000</code>.</li>
                            <li>Đẩy toàn bộ code lên <b>GitHub Pages</b> (như yêu cầu đồ án) $\\rightarrow$ Web sẽ hoạt động bình thường cho tất cả mọi người mà không bị lỗi này nhé!</li>
                        </ol>
                    </div>
                </div>
            `;
            
            // Xóa loading state
            document.getElementById('loadingState')?.remove();
            
            // Render Math trong thông báo lỗi
            renderMathInElement(elements.contentArea, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError: false
            });
            
        } else {
            elements.contentArea.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <h4 class="alert-heading"><i class="bi bi-exclamation-triangle"></i> Lỗi tải dữ liệu</h4>
                    <p>Không thể tải dữ liệu toán học. Lỗi: ${error.message}</p>
                    <hr>
                    <p class="mb-0">Vui lòng tải lại trang hoặc kiểm tra kết nối mạng.</p>
                </div>
            `;
        }
    }
}

// Generate UI Filters
function renderFilters() {
    const renderSubjectButtons = (items, container, isMobile) => {
        const accId = isMobile ? 'subAccMobile' : 'subAcc';
        container.innerHTML = `
            <div class="accordion accordion-flush" id="${accId}">
                <button class="filter-btn mb-2 w-100 text-start ${state.currentSubject === null ? 'active' : ''}" data-type="currentSubject" data-id="all" ${isMobile ? 'data-bs-dismiss="offcanvas"' : ''}>
                    Tất cả
                </button>
        `;
        let html = '';
        items.forEach(item => {
            const isSubActive = state.currentSubject === item.id;
            const showClass = isSubActive ? 'show' : '';
            const downIcon = `<i class="bi bi-chevron-down small text-muted"></i>`;
            
            let chaptersHtml = `
                <button class="filter-btn w-100 text-start ps-4 mb-1 border-0 bg-transparent ${isSubActive && state.currentChapter === null ? 'text-primary fw-bold' : 'text-muted'}" style="${isSubActive && state.currentChapter === null ? 'border-left: 2px solid var(--bs-primary) !important;' : ''}" data-type="currentSubject" data-id="${item.id}" ${isMobile ? 'data-bs-dismiss="offcanvas"' : ''}>
                    Chung (${item.name})
                </button>
            `;
            if (item.chapters) {
                item.chapters.forEach(ch => {
                    const isChActive = state.currentChapter === ch.id;
                    chaptersHtml += `
                        <button class="filter-btn w-100 text-start ps-4 mb-1 border-0 bg-transparent ${isChActive ? 'text-primary fw-bold' : 'text-muted'}" style="${isChActive ? 'border-left: 2px solid var(--bs-primary) !important;' : ''}" data-type="currentChapter" data-id="${ch.id}" data-subject-id="${item.id}" ${isMobile ? 'data-bs-dismiss="offcanvas"' : ''}>
                            ${ch.name}
                        </button>
                    `;
                });
            }
            
            html += `
                <div class="accordion-item bg-transparent border-0 mb-2">
                    <h2 class="accordion-header m-0 p-0">
                        <button class="filter-btn w-100 d-flex justify-content-between align-items-center ${isSubActive ? 'active' : ''}" data-type="currentSubject" data-id="${item.id}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${accId}-${item.id}">
                            <span>${item.name}</span> ${downIcon}
                        </button>
                    </h2>
                    <div id="collapse-${accId}-${item.id}" class="accordion-collapse collapse ${showClass}" data-bs-parent="#${accId}">
                        <div class="accordion-body p-0 pt-2 pb-1 border-start border-secondary border-opacity-25 ms-3">
                            ${chaptersHtml}
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML += html + '</div>';
    };

    const renderCategoryButtons = (items, container, type, isMobile) => {
        container.innerHTML = `
            <button class="filter-btn w-100 text-start mb-2 ${state[type] === null ? 'active' : ''}" data-type="${type}" data-id="all" ${isMobile ? 'data-bs-dismiss="offcanvas"' : ''}>
                Tất cả
            </button>
        `;
        items.forEach(item => {
            const isActive = state[type] === item.id ? 'active' : '';
            const icon = item.icon ? `<i class="bi ${item.icon} me-2 text-muted"></i>` : '';
            container.innerHTML += `
                <button class="filter-btn w-100 text-start mb-2 d-flex align-items-center ${isActive}" data-type="${type}" data-id="${item.id}" ${isMobile ? 'data-bs-dismiss="offcanvas"' : ''}>
                    ${icon}${item.name}
                </button>
            `;
        });
    };

    renderSubjectButtons(state.data.subjects, elements.subjectFilters, false);
    renderCategoryButtons(state.data.categories, elements.categoryFilters, 'currentCategory', false);
    
    // Clone for mobile offcanvas
    renderSubjectButtons(state.data.subjects, elements.mobileSubjectFilters, true);
    renderCategoryButtons(state.data.categories, elements.mobileCategoryFilters, 'currentCategory', true);
}

// Render Topics to Screen in Chunks
function renderTopicsChunk(isNew = false) {
    if (isNew) {
        elements.contentArea.innerHTML = '';
        state.renderedCount = 0;
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    const topicsToRender = state.currentResults.slice(state.renderedCount, state.renderedCount + state.pageSize);

    if (isNew && topicsToRender.length === 0) {
        elements.contentArea.innerHTML = `
            <div class="text-center py-5 my-5">
                <i class="bi bi-search text-muted" style="font-size: 3rem;"></i>
                <h4 class="mt-3 text-white">Không tìm thấy kết quả</h4>
                <p class="text-muted">Thử thay đổi từ khóa hoặc bộ lọc xem sao.</p>
                <button class="btn btn-primary mt-2 rounded-pill px-4" onclick="clearFilters()">Xóa tất cả bộ lọc</button>
            </div>
        `;
        return;
    }

    const oldLoadMore = document.getElementById('loadMoreBtnContainer');
    if (oldLoadMore) oldLoadMore.remove();

    let html = '';
    topicsToRender.forEach((topicObj, index) => {
        const topic = topicObj.item ? topicObj.item : topicObj;
        const subject = state.data.subjects.find(s => s.id === topic.subject_id);
        const category = state.data.categories.find(c => c.id === topic.category_id);
        
        // Robust LaTeX heading replacement that handles nested braces
        const replaceLatexHeading = (text, command) => {
            let result = text;
            const cmd = `\\\\${command}\\*?\\{`;
            const regex = new RegExp(cmd, 'g');
            let match;
            
            while ((match = regex.exec(result)) !== null) {
                let start = match.index;
                let braceStart = start + match[0].length - 1;
                let braceCount = 0;
                let braceEnd = -1;
                
                for (let i = braceStart; i < result.length; i++) {
                    if (result[i] === '{') braceCount++;
                    else if (result[i] === '}') braceCount--;
                    
                    if (braceCount === 0) {
                        braceEnd = i;
                        break;
                    }
                }
                
                if (braceEnd !== -1) {
                    const content = result.substring(braceStart + 1, braceEnd);
                    const tag = command === 'section' ? 'h3' : (command === 'subsection' ? 'h4' : 'h5');
                    const fsClass = command === 'section' ? 'fs-4' : (command === 'subsection' ? 'fs-5' : 'fs-6');
                    const fullMatch = result.substring(start, braceEnd + 1);
                    result = result.replace(fullMatch, `<${tag} class="mt-2 mb-1 text-primary ${fsClass}">${content}</${tag}>`);
                    regex.lastIndex = 0;
                }
            }
            return result;
        };

        let cleanContent = topic.content
            .replace(/\r\n/g, '\n')
            .replace(/\t/g, ' ') // Convert tabs to spaces
            .split('\n').map(line => line.trim()).join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\s+([.,!?;:)\]])/g, '$1')
            .replace(/([(\[])\s+/g, '$1')
            .replace(/\s+([.,!?;:)\]])/g, '$1')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        cleanContent = replaceLatexHeading(cleanContent, 'section');
        cleanContent = replaceLatexHeading(cleanContent, 'subsection');
        cleanContent = replaceLatexHeading(cleanContent, 'subsubsection');
        
        cleanContent = cleanContent.trim();
        const tagsHtml = topic.tags.map(tag => `<span class="tag-badge">#${tag}</span>`).join(' ');

        let relatedHtml = '';
        if (topic.related_ids && topic.related_ids.length > 0) {
            const relatedLinks = topic.related_ids.map(rId => {
                const rTopic = state.data.topics.find(t => t.id === rId);
                if(rTopic) {
                    return `<a href="#" class="related-link" data-action="view-topic" data-target="${rId}">
                                <i class="bi bi-link-45deg"></i> ${rTopic.title}
                            </a>`;
                }
                return '';
            }).join('');
            
            if(relatedLinks) {
                relatedHtml = `
                    <div class="related-section mt-4">
                        <h6 class="text-muted mb-3"><i class="bi bi-diagram-3"></i> Kiến thức liên quan</h6>
                        <div class="d-flex flex-wrap gap-2">
                            ${relatedLinks}
                        </div>
                    </div>
                `;
            }
        }

        html += `
            <article class="topic-card fade-in" style="animation-delay: ${(index % state.pageSize) * 0.05}s">
                <div class="d-flex flex-wrap gap-2 mb-3">
                    <span class="badge rounded-pill badge-subject">${subject ? subject.name : ''}</span>
                    <span class="badge rounded-pill badge-category">
                        ${category && category.icon ? `<i class="bi ${category.icon} me-1"></i>` : ''}${category ? category.name : ''}
                    </span>
                </div>
                <h3 class="topic-title fs-4 mb-3">${topic.title}</h3>
                <div class="topic-content">${cleanContent}</div>
                <div class="d-flex flex-wrap gap-2 mb-2">
                    ${tagsHtml}
                </div>
                ${relatedHtml}
            </article>
        `;
    });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    renderMathInElement(tempDiv, {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
    });

    while (tempDiv.firstChild) {
        elements.contentArea.appendChild(tempDiv.firstChild);
    }

    state.renderedCount += topicsToRender.length;

    if (state.renderedCount < state.currentResults.length) {
        const btnContainer = document.createElement('div');
        btnContainer.id = 'loadMoreBtnContainer';
        btnContainer.className = 'text-center my-4 fade-in';
        btnContainer.innerHTML = `
            <button class="btn btn-outline-light rounded-pill px-5 py-2 shadow-sm border-secondary border-opacity-50" onclick="loadMoreTopics()">
                <i class="bi bi-arrow-down-circle me-2"></i> Tải thêm (${state.currentResults.length - state.renderedCount} bài viết)
            </button>
        `;
        elements.contentArea.appendChild(btnContainer);
    }
}

window.loadMoreTopics = function() {
    renderTopicsChunk(false);
};

// Master Filter Pipeline
function applyFiltersAndSearch() {
    let results = [...state.data.topics];

    if (state.activeReference) {
        renderReferenceMaterials();
        updateBreadcrumb();
        return;
    }

    if (state.activeTool) {
        renderMathTools(state.activeTool);
        updateBreadcrumb();
        return;
    }

    // 1. Search Filter
    if (state.searchQuery.trim() !== '') {
        const searchResults = state.fuse.search(state.searchQuery);
        results = searchResults.map(res => res.item);
        
        elements.searchStatusArea.classList.remove('d-none');
        elements.searchStatusText.innerHTML = `Kết quả cho "<span class="text-white">${state.searchQuery}</span>"`;
        elements.searchResultCount.textContent = `${results.length} kết quả`;
    } else {
        elements.searchStatusArea.classList.add('d-none');
    }

    // 2. Subject Filter
    if (state.currentSubject && state.currentSubject !== 'all') {
        results = results.filter(t => t.subject_id === state.currentSubject);
        updateBreadcrumb();
    } else {
        elements.subjectBreadcrumb.classList.add('d-none');
    }

    // 2.5. Chapter Filter
    if (state.currentChapter) {
        results = results.filter(t => t.chapter_id === state.currentChapter);
        updateBreadcrumb();
    }

    // 3. Category Filter
    if (state.currentCategory && state.currentCategory !== 'all') {
        results = results.filter(t => t.category_id === state.currentCategory);
    }

    state.currentResults = results;
    renderTopicsChunk(true);
    renderFilters(); 
}

function updateBreadcrumb() {
    if (state.activeReference) {
        elements.subjectBreadcrumb.innerHTML = `<span class="text-white fw-medium"><i class="bi bi-journal-bookmark me-1 small"></i>Tài liệu tham khảo</span>`;
        elements.subjectBreadcrumb.classList.remove('d-none');
        return;
    }

    if (state.activeTool) {
        elements.subjectBreadcrumb.innerHTML = `<span class="text-white fw-medium"><i class="bi bi-cpu me-1 small"></i>Công cụ Chuyên nghiệp</span>`;
        elements.subjectBreadcrumb.classList.remove('d-none');
        return;
    }

    if(state.currentSubject && state.currentSubject !== 'all') {
        const subject = state.data.subjects.find(s => s.id === state.currentSubject);
        if (!subject) {
            elements.subjectBreadcrumb.classList.add('d-none');
            return;
        }
        
        let html = `<a href="#" class="breadcrumb-link text-decoration-none text-muted" data-type="currentSubject" data-id="${subject.id}">${subject.name}</a>`;
        
        if (state.currentChapter) {
            const chap = subject.chapters.find(c => c.id === state.currentChapter);
            if (chap) {
                html += ` <i class="bi bi-chevron-right mx-1 small opacity-50"></i> <span class="text-white">${chap.name}</span>`;
            }
        }
        elements.subjectBreadcrumb.innerHTML = html;
        elements.subjectBreadcrumb.classList.remove('d-none');
    } else {
        elements.subjectBreadcrumb.classList.add('d-none');
    }
}

// Clear Filters
window.clearFilters = function() {
    state.currentSubject = null;
    state.currentChapter = null;
    state.currentCategory = null;
    state.activeTool = null;
    state.activeReference = false;
    state.searchQuery = "";
    elements.searchInput.value = "";
    elements.clearSearchBtn.classList.add('d-none');
    applyFiltersAndSearch();
};

/** 
 * PROFESSIONAL MATH TOOLS IMPLEMENTATION
 */
function renderMathTools(toolId) {
    // IDEMPOTENCY: Don't re-render if we are already viewing this tool.
    const existingTool = elements.contentArea.querySelector('.tool-container');
    if (existingTool && existingTool.getAttribute('data-tool-id') === 'external-tools') return;

    elements.contentArea.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tool-container fade-in position-relative';
    container.setAttribute('data-tool-id', 'external-tools');
    
    container.innerHTML = `
        <div class="tool-badge">Professional Suite</div>
        <div class="tool-header">
            <h3 class="m-0"><i class="bi bi-cpu me-2"></i>Bộ công cụ Toán học Chuyên nghiệp</h3>
            <p class="text-muted mt-2">Truy cập các bộ giải toán mạnh mẽ nhất thế giới để có kết quả chính xác 100%.</p>
        </div>
        
        <div class="row g-4 mt-2">
            <!-- Wolfram Alpha Card -->
            <div class="col-md-6">
                <div class="topic-card h-100 scale-hover p-4 d-flex flex-column align-items-center text-center">
                    <div class="bg-danger bg-opacity-10 p-4 rounded-circle mb-3">
                        <i class="bi bi-stars text-danger fs-1"></i>
                    </div>
                    <h4 class="text-white">Wolfram Alpha</h4>
                    <p class="text-muted small">Giải tích, Đại số, Số học và mọi vấn đề khoa học với độ chi tiết cực cao (từng bước giải).</p>
                    <a href="https://www.wolframalpha.com/" target="_blank" class="btn btn-danger rounded-pill px-4 mt-auto">
                        Mở Wolfram Alpha <i class="bi bi-box-arrow-up-right ms-2"></i>
                    </a>
                </div>
            </div>

            <!-- Matrix Calculator Card -->
            <div class="col-md-6">
                <div class="topic-card h-100 scale-hover p-4 d-flex flex-column align-items-center text-center">
                    <div class="bg-primary bg-opacity-10 p-4 rounded-circle mb-3">
                        <i class="bi bi-grid-3x3 text-primary fs-1"></i>
                    </div>
                    <h4 class="text-white">Matrix Calculator</h4>
                    <p class="text-muted small">Tính toán ma trận cấp n, tìm định thức, nghịch đảo, trị riêng... với giao diện chuyên nghiệp.</p>
                    <a href="https://matrixcalc.org/vi/" target="_blank" class="btn btn-primary rounded-pill px-4 mt-auto">
                        Mở Máy tính Ma trận <i class="bi bi-box-arrow-up-right ms-2"></i>
                    </a>
                </div>
            </div>
        </div>

        <div class="alert alert-info mt-5 bg-dark bg-opacity-25 border-info border-opacity-25">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Lưu ý:</strong> Bạn sẽ được chuyển hướng sang tab mới để sử dụng các công cụ này. Điều này đảm bảo bạn luôn tiếp cận được những tính năng mới nhất và độ chính xác tuyệt đối.
        </div>
    `;
    elements.contentArea.appendChild(container);
}

/**
 * REFERENCE MATERIALS IMPLEMENTATION
 */
function renderReferenceMaterials() {
    elements.contentArea.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tool-container fade-in';
    
    let filesHtml = '';
    state.referenceFiles.forEach((file, index) => {
        filesHtml += `
            <div class="col-md-6 col-lg-4">
                <div class="topic-card h-100 scale-hover p-4 d-flex flex-column align-items-center text-center" style="animation-delay: ${index * 0.05}s">
                    <div class="bg-primary bg-opacity-10 p-4 rounded-circle mb-3">
                        <i class="bi bi-file-earmark-pdf text-primary fs-1"></i>
                    </div>
                    <span class="badge bg-secondary bg-opacity-25 text-muted mb-2">${file.type}</span>
                    <h5 class="text-white mb-3">${file.name}</h5>
                    <div class="mt-auto d-flex gap-2 w-100">
                        <a href="thamkhao/${file.filename}" target="_blank" class="btn btn-outline-light rounded-pill flex-grow-1 small py-2">
                            <i class="bi bi-eye me-1"></i> Xem
                        </a>
                        <a href="thamkhao/${file.filename}" download class="btn btn-primary rounded-pill flex-grow-1 small py-2 shadow-sm" style="background: linear-gradient(45deg, #4f46e5, #9333ea); border: none;">
                            <i class="bi bi-cloud-arrow-down me-1"></i> Tải về
                        </a>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="tool-badge">Tài liệu học tập</div>
        <div class="tool-header mb-4">
            <h3 class="m-0"><i class="bi bi-journal-bookmark me-2"></i>Thư viện tài liệu tham khảo</h3>
            <p class="text-muted mt-2">Tổng hợp các giáo trình, bài giảng và tài liệu ôn tập chất lượng cao dành cho sinh viên.</p>
        </div>
        
        <div class="row g-4 mt-2">
            ${filesHtml}
        </div>

        <div class="alert alert-info mt-5 bg-dark bg-opacity-25 border-info border-opacity-25">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Mẹo:</strong> Bạn có thể nhấn vào "Xem" để đọc trực tiếp trên trình duyệt hoặc "Tải về" để lưu trữ tài liệu offline.
        </div>
    `;
    elements.contentArea.appendChild(container);
}

// [Legacy Matrix & Solver functions removed - replaced by external tools suite above]

// Event Listeners
function setupEventListeners() {
    // Theme Toggle Logic (Priority: should work even if other UI elements fail)
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    // Search Input Logic
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            if(state.searchQuery.length > 0) {
                elements.clearSearchBtn?.classList.remove('d-none');
            } else {
                elements.clearSearchBtn?.classList.add('d-none');
            }
            applyFiltersAndSearch();
        });
    }

    if (elements.clearSearchBtn) {
        elements.clearSearchBtn.addEventListener('click', () => {
            state.searchQuery = "";
            elements.searchInput.value = "";
            elements.clearSearchBtn.classList.add('d-none');
            elements.searchInput.focus();
            applyFiltersAndSearch();
        });
    }

    // Form submit prevention
    const mainSearchForm = document.getElementById('mainSearchForm');
    if (mainSearchForm) {
        mainSearchForm.addEventListener('submit', e => {
            e.preventDefault();
            elements.searchInput?.blur(); // dismiss keyboard on mobile
        });
    }

    // Filter Buttons (Document delegation for dynamic content)
    document.addEventListener('click', (e) => {
        const filterBtn = e.target.closest('.filter-btn') || e.target.closest('.breadcrumb-link');
        if (filterBtn) {
            const type = filterBtn.dataset.type;
            const id = filterBtn.dataset.id;
            
            if (type) {
                if (type === 'currentSubject') {
                    state.currentSubject = id === 'all' ? null : id;
                    state.currentChapter = null;
                    state.activeTool = null;
                } else if (type === 'currentChapter') {
                    state.currentChapter = id;
                    state.currentSubject = filterBtn.dataset.subjectId;
                    state.activeTool = null;
                    state.activeReference = false;
                } else if (type === 'tool') {
                    state.activeTool = id;
                    // Reset other filters to avoid confusion
                    state.currentSubject = null;
                    state.currentChapter = null;
                    state.currentCategory = null;
                    state.activeReference = false;
                } else if (type === 'reference') {
                    state.activeReference = true;
                    state.activeTool = null;
                    state.currentSubject = null;
                    state.currentChapter = null;
                    state.currentCategory = null;
                } else {
                    state[type] = id === 'all' ? null : id;
                    state.activeTool = null;
                    state.activeReference = false;
                }
                
                // Active Class Management for non-accordion tools
                if (type === 'tool' || type === 'reference' || id === 'all') {
                    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                    filterBtn.classList.add('active');
                }

                // Scroll to top of results on mobile, unless it's just toggling the accordion
                if(window.innerWidth < 992 && !filterBtn.hasAttribute('data-bs-toggle')) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                
                applyFiltersAndSearch();
            }
        }

        // Home Breadcrumb
        const homeLink = e.target.closest('#homeBreadcrumb');
        if (homeLink) {
            e.preventDefault();
            clearFilters();
        }
        
        // Related Links logic
        const relatedLink = e.target.closest('[data-action="view-topic"]');
        if (relatedLink) {
            e.preventDefault();
            const targetId = relatedLink.dataset.target;
            const targetTopic = state.data.topics.find(t => t.id === targetId);
            
            if(targetTopic) {
                // Temporarily filter to show ONLY this specific topic
                state.searchQuery = "";
                elements.searchInput.value = "";
                elements.clearSearchBtn.classList.add('d-none');
                state.currentSubject = targetTopic.subject_id;
                state.currentChapter = targetTopic.chapter_id || null;
                state.currentCategory = targetTopic.category_id;
                
                // Directly render just this topic to stand out
                state.currentResults = [targetTopic];
                renderTopicsChunk(true);
                renderFilters();
                updateBreadcrumb();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    });

    // Back to top logic
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            elements.btnBackToTop.classList.add('show');
        } else {
            elements.btnBackToTop.classList.remove('show');
        }
    });

    if (elements.btnBackToTop) {
        elements.btnBackToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    if (!elements.themeToggle) return;
    const icon = elements.themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'bi bi-moon-stars-fill';
    } else {
        icon.className = 'bi bi-sun-fill';
    }
}

// Boot application
document.addEventListener('DOMContentLoaded', init);
