# CHƯƠNG 3. THIẾT KẾ VÀ TRIỂN KHAI HỆ THỐNG

Chương này trình bày chi tiết về kiến trúc phần mềm, các mô hình dữ liệu lõi, và những thuật toán nền tảng được áp dụng để xây dựng hệ thống tra cứu cơ sở toán học. Toàn bộ thiết kế được định hướng bởi ba tiêu chí tối quan trọng: **Hiệu năng truy xuất tức thời (Ultra-low latency)**, **Tính toàn vẹn của ngôn ngữ toán học (Mathematical Integrity)**, và **Trải nghiệm người dùng liền mạch (Seamless UX)**.

## 3.1. Kiến trúc tổng thể và luồng xử lý của hệ thống

Hệ thống tra cứu cơ sở toán học được thiết kế theo kiến trúc Ứng dụng web tĩnh một trang (Single-Page Application - SPA) theo triết lý **Jamstack** (JavaScript, APIs, Markup) kết hợp với kiến trúc Phi máy chủ (Serverless Architecture). Mục tiêu tối thượng của thiết kế này là mang lại tốc độ truy xuất tức thời, giảm thiểu tối đa độ trễ do giao tiếp mạng, đồng thời đảm bảo khả năng triển khai linh hoạt trên bất kỳ hạ tầng lưu trữ tĩnh (Edge CDN) nào (như GitHub Pages, Vercel, Netlify) mà không đòi hỏi tài nguyên máy chủ cơ sở dữ liệu truyền thống (như MySQL, PostgreSQL hay MongoDB).

Khác với các mô hình Monolithic (Nguyên khối) hay MVC (Model-View-Controller) truyền thống nơi máy chủ phải tốn chu kỳ CPU để render từng trang HTML (Server-Side Rendering - SSR), hệ thống này chuyển dịch toàn bộ gánh nặng tính toán sang thiết bị của người dùng (Client-Side Rendering). Điểm đột phá trong kiến trúc này là việc phân tách hoàn toàn vòng đời dữ liệu thành hai pha độc lập: Pha tiền xử lý dữ liệu (Build-time Data Pipeline) và Pha thực thi phía máy khách (Runtime Execution).

### 3.1.1. Pha tiền xử lý dữ liệu (Build-time Data Pipeline)
Trong môi trường phát triển, một luồng quy trình tự động (ETL - Extract, Transform, Load) được thiết lập thông qua kịch bản `build_data.js` chạy trên nền tảng runtime Node.js (V8 Engine). Quá trình này mô phỏng lại một phần nguyên lý hoạt động của một trình biên dịch (Compiler):
- Khối mã nguồn đầu vào là các tệp định dạng LaTeX nguyên thủy (`chuong1.tex`, `chuong2.tex`,...).
- Kịch bản Node.js sẽ đóng vai trò như một bộ phân tích cú pháp (Parser), quét tuần tự qua các tệp này, sử dụng các thuật toán (sẽ được trình bày chi tiết ở mục 3.3) để nhận diện, trích xuất và bóc tách các đơn vị kiến thức có giá trị như định lý, hệ quả, ví dụ minh họa và bảng biểu.
- Các hình ảnh phức tạp (như đồ thị vẽ bằng mã lệnh TikZ) sẽ được đẩy qua một luồng xử lý phụ, gọi các tiến trình hệ điều hành (`child_process`) để biên dịch gián tiếp thông qua trình biên dịch `pdflatex` và chuyển đổi sang định dạng vector SVG thông qua công cụ `pdftocairo`.
- Cuối cùng, toàn bộ khối tri thức sau khi được chuẩn hóa (Transform) sẽ được kết xuất (Load) và đóng gói vào một tệp duy nhất là `data.json`. Tệp này đóng vai trò như một cơ sở dữ liệu phi cấu trúc (NoSQL Document Store), được tối ưu hóa dung lượng để sẵn sàng phục vụ cho ứng dụng web.

### 3.1.2. Pha thực thi phía máy khách (Runtime Execution)
Khi người dùng truy cập ứng dụng web, toàn bộ giao diện tĩnh (HTML/CSS) và khối logic điều khiển (`app.js`) sẽ được tải về trình duyệt thông qua mạng lưới phân phối nội dung (CDN). Ngay trong quá trình khởi tạo ứng dụng (`init()`), một luồng Fetch API bất đồng bộ (Asynchronous) sẽ được kích hoạt để tải tệp `data.json` trực tiếp vào bộ nhớ cục bộ (RAM) của thiết bị người dùng.

Từ thời điểm này, ứng dụng chuyển sang trạng thái tự trị hoàn toàn (Fully Autonomous). Mọi thao tác tìm kiếm, lọc dữ liệu theo bộ môn, và kết xuất công thức toán học phức tạp (thông qua thư viện KaTeX) đều được thực hiện nội bộ bằng tài nguyên CPU/GPU của máy khách. Cách tiếp cận "đưa toàn bộ cơ sở dữ liệu đến gần người dùng nhất" này giúp thời gian phản hồi cho mọi truy vấn (Query Latency) chỉ tính bằng mili-giây (ms). Theo độ phức tạp thuật toán, việc tra cứu trên mảng JSON được nạp sẵn trong RAM đạt thời gian $O(N)$ cho lọc và $O(1)$ cho truy xuất Index, tạo ra trải nghiệm mượt mà không thua kém các ứng dụng Desktop native (Native Apps).

## 3.2. Mô hình hóa dữ liệu tri thức (Cấu trúc file data.json)

Với đặc thù của một hệ thống tra cứu nhanh, cấu trúc dữ liệu cần thỏa mãn hai yếu tố: khả năng truy xuất với độ phức tạp thuật toán thấp (phục vụ bộ máy tìm kiếm) và tính phân cấp rõ ràng (phục vụ bộ lọc đa chiều). Do không sử dụng cơ sở dữ liệu quan hệ (RDBMS) với các bảng (Tables) và khóa ngoại (Foreign Keys), toàn bộ mô hình thực thể - liên kết (Entity-Relationship Model) được ánh xạ trực tiếp sang cấu trúc JSON phân cấp dạng cây (Tree-like structure).

Lược đồ dữ liệu (Data Schema) được tổ chức thành hai khối cấu trúc chính: mảng `subjects` (Định nghĩa không gian tri thức) và mảng `topics` (Thực thể tri thức cốt lõi).

### 3.2.1. Cấu trúc định tuyến và Phân loại học (Subjects Array)
Mảng `subjects` đóng vai trò như một hệ thống phân loại học (Taxonomy), lưu trữ thông tin về các bộ môn toán học và cấu trúc chương mục của chúng. Ví dụ:

```json
"subjects": [
  {
    "id": "gt1",
    "name": "Giải tích 1",
    "chapters": [
      {"id": "ch1", "name": "Chương 1: Số thực và Hàm số"},
      {"id": "ch2", "name": "Chương 2: Đạo hàm và Vi phân"}
    ]
  },
  {
    "id": "dstt",
    "name": "Đại số tuyến tính",
    "chapters": [
      {"id": "ch6", "name": "Chương 6: Không gian Vector"}
    ]
  }
]
```
Kiến trúc định tuyến này cho phép giao diện người dùng (UI) áp dụng mẫu thiết kế Component-based. Các phần tử trên thanh điều hướng (Sidebar) được sinh ra động (Dynamic Rendering) thông qua hàm `renderFilters()`, thay vì bị mã hóa cứng (hardcoded) trong DOM. Điều này đảm bảo tính mở rộng cao (High Scalability); khi có nhu cầu bổ sung môn học mới, hệ thống chỉ cần cập nhật dữ liệu JSON mà không cần biên dịch lại mã nguồn giao diện.

### 3.2.2. Khối thực thể tri thức (Topics Array)
Mỗi phần tử trong mảng `topics` là một Object đại diện cho một mẩu kiến thức (Knowledge Node) độc lập. Để phục vụ thuật toán tìm kiếm mờ (Fuzzy Search) và bộ lọc phức hợp, một Topic được thiết kế với cấu trúc chuẩn hóa dư thừa (Denormalized) nhằm đánh đổi không gian lưu trữ lấy tốc độ truy xuất:

```json
{
  "id": "auto-101",
  "subject_id": "gt1",
  "chapter_id": "ch1",
  "category_id": "property",
  "title": "Định lý giá trị trung gian (Bolzano-Cauchy)",
  "content": "<p>Nội dung định lý đã được biên dịch thành HTML kết hợp KaTeX $$ f(x) = 0 $$...</p>",
  "tags": ["định lý giá trị trung gian", "hàm liên tục", "nghiệm"],
  "related_ids": ["auto-102", "auto-105"]
}
```

Trong đó:
- Các trường `subject_id`, `chapter_id`, `category_id` đóng vai trò là các khóa ngoại ảo (Virtual Foreign Keys). Quá trình xử lý phía client sử dụng các khóa này để thực hiện hàm `Array.prototype.filter()`, tạo ra các bộ giao (Intersection sets) nhanh chóng.
- Trường `content` lưu trữ toàn bộ mã HTML và KaTeX đã qua bước tinh chế tại pha Build-time. Việc tiền xử lý (Pre-computing) nội dung này (ví dụ: chuyển đổi `\textbf{}` thành `<strong>`) giúp giảm tải chu kỳ CPU cho trình duyệt của người dùng trong pha Runtime.
- Mảng `related_ids` cung cấp một biểu diễn đồ thị liền kề (Adjacency List Graph representation), giúp hệ thống gợi ý sinh viên nhảy cóc từ một khái niệm này sang một bài tập liên quan thông qua tính năng "Kiến thức liên quan", mô phỏng lại cách mạng nơ-ron não bộ liên kết thông tin.

## 3.3. Triển khai quy trình xử lý dữ liệu tự động (ETL Pipeline)

Quy trình ETL (Extract, Transform, Load) là "trái tim" của hệ thống xử lý hậu trường. Mã nguồn gốc của giáo trình toán thường được soạn thảo bằng LaTeX, một ngôn ngữ đánh dấu cực kỳ mạnh mẽ trong việc tạo hình toán học nhưng lại rất phi cấu trúc (Unstructured) khi xét dưới góc độ dữ liệu máy tính. Việc trích xuất tri thức từ khối văn bản thô này yêu cầu các giải pháp thuật toán phân tích cú pháp (Parsing Algorithms) chuyên biệt.

### 3.3.1. Thuật toán phân tích cú pháp LaTeX lồng nhau (Nested Parsing)
Một trong những bài toán kinh điển trong Khoa học Máy tính khi xử lý mã nguồn (bao gồm cả LaTeX) là tính chất lồng nhau của các cặp lệnh (Nested Scopes). Ví dụ, một đoạn mã in đậm có thể chứa bên trong một đoạn mã in nghiêng, và bên trong đoạn in nghiêng lại chứa các phân số toán học: `\textbf{Khái niệm \textit{giới hạn \frac{a}{b}}}`.

Xét trên phương diện Lý thuyết Ôtômát (Automata Theory), việc sử dụng Biểu thức chính quy (Regular Expression) thuần túy không thể giải quyết triệt để bài toán này. Regex tương đương với một Ôtômát hữu hạn trạng thái (Finite State Automaton - FSA), chỉ có thể nhận dạng các Ngôn ngữ chính quy (Regular Languages), hoàn toàn bất lực trước Ngôn ngữ phi ngữ cảnh (Context-Free Grammar) yêu cầu quản lý trạng thái đếm số lượng mở-đóng ngoặc. Do đó, hệ thống bắt buộc phải phát triển một hàm đệ quy `replaceLatexCommand` mô phỏng thuật toán Ôtômát đẩy xuống (Pushdown Automaton - PDA) sử dụng ngăn xếp (Stack).

**Mô tả mã giả (Pseudocode) của thuật toán Brace Matching:**
1. Khởi tạo một con trỏ quét toàn bộ chuỗi ký tự để định vị hàm lệnh (ví dụ: `\textbf{`).
2. Khởi tạo biến đếm `braceCount = 1` tại vị trí ngay sau dấu ngoặc mở `{` đầu tiên (đại diện cho thao tác Push vào Stack).
3. Vòng lặp duyệt tuyến tính $O(N)$ qua từng ký tự tiếp theo trong chuỗi:
   - Nếu gặp dấu ngoặc nhọn mở `{`, thực hiện thao tác Push (`braceCount++`).
   - Nếu gặp dấu ngoặc nhọn đóng `}`, thực hiện thao tác Pop (`braceCount--`).
   - Mệnh đề bảo vệ (Guard Clause): Vòng lặp đặc biệt bỏ qua các ký tự ngoặc nhọn bị escape (như `\{` hoặc `\}`) để tránh đếm sai.
4. Khi Stack rỗng (`braceCount == 0`), thuật toán đã xác định được chính xác ranh giới của toàn bộ khối nội dung lồng bên trong. Rút trích khối này với độ phức tạp $O(1)$ nhờ chỉ mục index.
5. Nội dung trích xuất này lại tiếp tục được truyền đệ quy (Recursion) vào chính hàm `replaceLatexCommand` để xử lý các lớp lồng sâu hơn (độ phức tạp phân tích cây cú pháp Abstract Syntax Tree - AST).
6. Cuối cùng, cặp ngoặc được thay thế bằng cặp thẻ DOM tương ứng (như `<strong>...</strong>`).

Cơ chế xử lý nghiêm ngặt này đảm bảo sự toàn vẹn của mã nguồn toán học nằm lọt thỏm giữa các lớp định dạng văn bản, giúp trình kết xuất KaTeX phía giao diện hoạt động hoàn hảo mà không bị đứt gãy (Syntax Error).

### 3.3.2. Cơ chế tự động biên dịch TikZ sang vector SVG bằng Cầu nối Tiến trình (Process Bridge)
Thư viện KaTeX trên trình duyệt tuy vô cùng xuất sắc trong việc kết xuất các biểu thức đại số, nhưng lại không hỗ trợ các đoạn mã vẽ đồ họa như gói lệnh TikZ (do TikZ yêu cầu thư viện tính toán PGF lõi của hệ thống TeX nội bộ). Để đưa các biểu đồ hình học tĩnh lên giao diện Web mà không làm giảm chất lượng, quy trình ETL đã triển khai một cơ chế biên dịch độc lập phía máy chủ sử dụng Cầu nối Tiến trình.

**Luồng hoạt động của cơ chế biên dịch TikZ (TikZ Compilation Event Loop):**
1. **Trích xuất & Hashing:** Trong pha quét dữ liệu, khối mã nguồn nằm giữa `\begin{tikzpicture}` và `\end{tikzpicture}` được bóc tách. Để tránh việc thao tác I/O ổ cứng và biên dịch lại hàng trăm hình ảnh gây ra hiện tượng thắt cổ chai thời gian O($N^2$) sau mỗi lần chạy script, hệ thống áp dụng hàm băm mật mã học MD5 (Message-Digest algorithm 5). Mã băm 8 ký tự này sẽ là định danh duy nhất (Unique Identifier) đóng vai trò làm khóa Cache cho hình ảnh đó (Ví dụ: `tikz_7a2f9b1c.svg`). Thuật toán chỉ tiến hành biên dịch nếu mã băm chưa tồn tại trong thư mục đích.
2. **Khởi tạo môi trường Sandbox:** Hệ thống tự động sinh ra một tài liệu LaTeX tạm thời (`.tex`). Tài liệu này sử dụng lớp (class) `standalone` với tham số `border=2mm`, đảm bảo bounding box của hình ảnh đầu ra chỉ ôm sát mép viền đồ thị chứ không sinh ra khoảng trắng dư thừa của khổ giấy A4.
3. **Thực thi tiến trình con (Child Process Execution):** Thông qua API `child_process.execSync` của Node.js, luồng thực thi JS chính sẽ dừng lại để gọi trực tiếp hệ thống mã nguồn LaTeX của máy chủ (TeX Live/MiKTeX) với lệnh `pdflatex -interaction=nonstopmode -halt-on-error`. Việc truyền tham số `nonstopmode` mang tính sống còn đối với luồng CI/CD tự động, giúp script bỏ qua cảnh báo hoặc chủ động thoát lập tức thay vì bị treo lại (Deadlock) chờ phản hồi từ luồng `stdin` nếu mã TikZ chứa lỗi.
4. **Chuyển đổi sang chuẩn Vector:** Để thích ứng hoàn hảo với môi trường Web đòi hỏi hình ảnh sắc nét trên các màn hình mật độ điểm ảnh cao (Retina Display), hệ thống tiếp tục gọi công cụ `pdftocairo -svg` để biến đổi tệp PDF nhị phân vừa tạo thành mã XML của chuẩn Scalable Vector Graphics (SVG). Dữ liệu SVG duy trì thuộc tính toán học của các đường vector nên không bị vỡ hạt (lossless) ở bất kỳ mức độ Zoom nào.
5. **Cơ chế đảo màu thích ứng:** Để hình nền trắng của đồ thị TikZ không gây chói mắt và phá vỡ cấu trúc hiển thị của Giao diện Tối (Dark Mode), hệ thống can thiệp thẳng vào bộ lọc CSS nội tuyến: `filter: invert(0.9) hue-rotate(180deg);`. Phép toán ma trận màu (Color Matrix) này biến đổi trắng thành xám đen và đồng thời đảo ngược vòng tròn màu sắc để giữ nguyên các màu nhấn (đỏ, xanh, vàng) của đồ thị gốc.

## 3.4. Triển khai logic tìm kiếm và tối ưu hóa kết quả

Trái tim của trải nghiệm người dùng trong một hệ thống tra cứu là tốc độ và sự chính xác của bộ máy tìm kiếm (Search Engine). Khác với các truy vấn SQL bằng từ khóa `LIKE` truyền thống (thường thất bại ngay lập tức nếu người dùng gõ sai chỉ một ký tự hoặc thiếu dấu tiếng Việt), hệ thống này áp dụng công cụ Tìm kiếm Mờ (Fuzzy Search) chạy thuần túy phía client thông qua thư viện JavaScript mã nguồn mở `Fuse.js`.

### 3.4.1. Toán học đằng sau thuật toán tìm kiếm mờ và Cấu hình trọng số
Fuse.js cốt lõi hoạt động dựa trên thuật toán **Bitap Algorithm** (còn gọi là thuật toán Baeza-Yates-Gonnet). Đây là một thuật toán đối sánh mẫu xấp xỉ sử dụng các phép toán mức bit (bitwise operations - như dịch bit shift, AND, OR) song song để tính toán Khoảng cách Levenshtein (Levenshtein Distance) với tốc độ chớp nhoáng (Blazing fast). Khoảng cách Levenshtein đo lường số lượng thao tác tối thiểu (chèn, xóa, hoặc thay thế một ký tự) cần thiết để biến đổi chuỗi này thành chuỗi khác.

Để điều hướng bộ máy tìm kiếm này ưu tiên trả về các kết quả có giá trị học thuật cao nhất, cấu hình khởi tạo không gian đối sánh tại `app.js` được thiết lập hệ số như sau:

```javascript
const fuseOptions = {
    keys: [
        { name: 'title', weight: 0.5 },
        { name: 'tags', weight: 0.3 },
        { name: 'content', weight: 0.2 }
    ],
    threshold: 0.4,
    ignoreLocation: true
};
```

**Phân tích chiến lược phân bổ trọng số (Weighted Scoring Strategy):**
- **Tiêu đề (`title` - Tầm quan trọng 50%):** Tiêu đề thường chứa cụm danh từ cốt lõi xác định bản chất của thực thể tri thức (VD: "Định lý Rolle"). Việc gán trọng số cao nhất đảm bảo rằng nếu thuật toán Bitap ghi nhận mức độ khớp cao (match score gần 0) ở trường này, điểm số tổng hợp của bài viết đó sẽ cực thấp (điểm thấp đồng nghĩa với mức độ liên quan cao), đẩy nó nhảy vọt lên top đầu kết quả.
- **Nhãn (`tags` - Tầm quan trọng 30%):** Hoạt động như các Meta Keywords. Hệ thống sinh nhãn tự động tại pha ETL dựa trên các từ đồng nghĩa và từ khóa phụ, giúp gom nhóm tri thức (Clustering).
- **Nội dung (`content` - Tầm quan trọng 20%):** Đóng vai trò là Mạng lưới an toàn (Fallback net). Tính năng này phát huy tác dụng khi sinh viên tìm kiếm một cụm từ cụ thể hoặc công thức nằm ẩn sâu bên trong định nghĩa mà không nằm trên tiêu đề.
- **Ngưỡng dung sai (`threshold: 0.4`):** Điểm bùng phát của thuật toán. Thang điểm dung sai (Error Tolerance) chạy từ 0.0 (chính xác tuyệt đối) đến 1.0 (trả về toàn bộ cơ sở dữ liệu). Mức 0.4 là điểm ngọt (Sweet Spot) được hiệu chỉnh vi chỉnh (finetuned) sau nhiều vòng thử nghiệm. Nó đủ lỏng lẻo để tha thứ cho các lỗi đánh máy (typos), lỗi không gõ dấu tiếng Việt (ví dụ gõ "dao ham" vẫn tìm ra "Đạo hàm"), nhưng cũng đủ khắt khe để loại bỏ các cấu trúc nhiễu (False Positives). Thuộc tính `ignoreLocation: true` cấu hình thuật toán quét toàn bộ không gian văn bản thay vì suy giảm điểm số theo khoảng cách từ đầu chuỗi văn bản.

### 3.4.2. Kỹ thuật Render Chunks (Pagination/Lazy Rendering) và Quản lý Event Loop
Khi sinh viên nhập một từ khóa phổ biến (ví dụ: "ma trận"), hệ thống có thể đối sánh thành công hàng trăm mảnh kiến thức. Về mặt kiến trúc Trình duyệt (Browser Architecture), nếu chúng ta áp đặt JavaScript nhồi (inject) hàng ngàn node DOM phức tạp (đặc biệt là các chuỗi thẻ `<span>` chứa công thức KaTeX) vào Cây DOM (Document Object Model) cùng một lúc, Engine kết xuất (như Blink của Chrome) sẽ mất quá nhiều thời gian để tính toán lại bố cục (Layout/Reflow) và đổ màu (Paint).

Việc thực thi đồng bộ (Synchronous Execution) khổng lồ này sẽ chặn đứng Luồng chính (Main Thread Blocking). Trình duyệt sẽ rớt khung hình (Frame Drop) thảm hại xuống dưới 60 FPS, giao diện sẽ bị đơ cứng (Frozen UI), không tiếp nhận phản hồi từ con trỏ chuột hay thao tác cuộn. Đây là một thảm họa UX (User Experience).

Để giải quyết bài toán nút thắt cổ chai hiển thị này, hệ thống áp dụng kỹ thuật **Phân mảnh kết xuất (Render Chunks hay Lazy Pagination)**. Triết lý ở đây là "Chỉ hiển thị những gì người dùng có thể thấy ngay lập tức".

Hàm `renderTopicsChunk(isNew)` được thiết kế như một bộ đệm kiểm soát luồng (Flow Control Buffer), chỉ bơm vào DOM một tập hợp con nhỏ dữ liệu tại một thời điểm:

```javascript
const pageSize = 10;
// Slice mảng kết quả lấy đúng 10 phần tử tiếp theo với độ phức tạp O(k)
const topicsToRender = state.currentResults.slice(state.renderedCount, state.renderedCount + pageSize);

// Quá trình render DOM và gọi KaTeX parser chỉ thực hiện trên đúng 10 phần tử này
state.renderedCount += topicsToRender.length;
```

**Sơ đồ khối của Luồng tối ưu hóa DOM an toàn:**
1. Trích xuất một `chunk` gồm tối đa 10 đối tượng JSON từ tập kết quả bộ nhớ.
2. Nối chuỗi nội dung HTML của các bài viết này vào một đối tượng bộ nhớ đệm ẩn danh (`document.createElement('div')`). Thao tác trên Document Fragment hoặc Virtual DOM ẩn này không kích hoạt quá trình Reflow của luồng hiển thị chính.
3. Gọi hàm `renderMathInElement` của engine KaTeX để quét các cặp ký tự phân cách `$ ... $` và `$$ ... $$`, sau đó biên dịch chúng thành các Node DOM cấu trúc toán học ngay trên bộ đệm ảo. Tốc độ biên dịch lúc này đạt mức tối đa do không bị chi phối bởi quy trình vẽ (Painting) của màn hình.
4. Di chuyển (Append/Attach) khối DOM đã biên dịch hoàn thiện này vào vị trí hiển thị thật (`contentArea`) trên giao diện người dùng. Đây là lần duy nhất luồng Main Thread bị buộc phải cập nhật giao diện, tiêu tốn chỉ vài mili-giây.
5. Hệ thống kiểm tra điều kiện biên: Nếu số bài viết đã kết xuất vẫn nhỏ hơn tổng kích thước của mảng kết quả (`state.renderedCount < state.currentResults.length`), một nút "Tải thêm" (Load More) kèm theo biến đếm sẽ được đính kèm vào cuối danh sách. Khi người dùng chủ động tương tác hoặc cuộn tới mép dưới màn hình, Event Listener sẽ giải phóng `chunk` tiếp theo.

Kỹ thuật chia để trị luồng sự kiện (Event Loop Chunking) này đảm bảo Chỉ số Thời gian hiển thị và tương tác (Time to Interactive - TTI) của ứng dụng luôn nằm dưới ngưỡng 50ms, đáp ứng tiêu chuẩn khắt khe về ngân sách hiệu năng RAIL (Response, Animation, Idle, Load) do Google đề xuất.

## 3.5. Thiết kế giao diện và trải nghiệm người dùng (UI/UX)

Yếu tố tiên quyết để đảm bảo tính khả dụng của một hệ thống công nghệ giáo dục (EdTech) là giao diện người dùng. Nó phải trực quan, tuân thủ nguyên lý thiết kế lấy con người làm trung tâm (Human-Centered Design), và triệt tiêu yếu tố gây mỏi mắt trong những phiên học tập kéo dài (Cognitive Load). Giao diện của phần mềm được kiến trúc hóa dựa trên nền tảng Bootstrap 5, ứng dụng triết lý thiết kế hiện đại Glassmorphism (Hiệu ứng kính mờ phân lớp) để tạo chiều sâu không gian quang học (Optical Depth).

### 3.5.1. Hệ thống lọc tri thức đa tầng (Set Intersection Pipeline)
Thanh điều hướng bên trái (Sidebar) đóng vai trò là một Bảng điều khiển bộ lọc đa tầng, thiết kế theo kiến trúc đường ống dẫn dữ liệu (Data Pipeline Architecture). Lõi logic nghiệp vụ phía dưới được điều phối tập trung bởi hàm `applyFiltersAndSearch()`. Về mặt bản chất toán học rời rạc, hàm này chính là sự thực thi của nguyên lý "Giao các tập hợp" (Set Intersection).

Mỗi khi người dùng nhấp chuột thay đổi điều kiện (Ví dụ: Đang xem toàn bộ, nhấp chọn môn Đại số), ứng dụng tức thời thu thập 4 trạng thái toàn cục trong đối tượng State Store: `searchQuery`, `currentSubject`, `currentChapter`, và `currentCategory`. Quá trình chuyển đổi dữ liệu được áp dụng tuần tự tạo thành các bộ lọc chồng (Cascading Filters):
1. **Lọc nội dung (Content Filtering):** Nếu tồn tại truy vấn tìm kiếm, không gian mẫu $U$ (Toàn bộ dữ liệu) được ánh xạ qua bộ máy Fuse.js để tạo ra tập con $S$ (Kết quả tìm kiếm). Nếu không, $S = U$.
2. **Lọc định tuyến (Routing Filtering):** Tập $S$ tiếp tục được duyệt qua bộ lọc Môn học thông qua hàm `Array.prototype.filter()`, tạo ra tập con $A$.
3. **Lọc không gian cục bộ (Local Scope Filtering):** Thu hẹp tập $A$ theo điều kiện mã chương $chapter\_id$, kết xuất tập con $C$.
4. **Phân loại học (Taxonomy Filtering):** Cuối cùng, tập $C$ được lọc lần cuối theo nhãn phân loại tri thức (định lý, bài tập...), tạo ra tập kết quả tối hậu $R = S \cap A \cap C \cap T$.

Sự thanh lịch của kiến trúc thuật toán này nằm ở khả năng "cô lập" (Isolate) chính xác những khái niệm trừu tượng theo hệ trục tọa độ đa chiều. Một tác vụ phức tạp như "Tìm mọi Định lý (Trục Category) liên quan đến thuật ngữ ma trận nghịch đảo (Trục Content) trong Chương 6 (Trục Chapter) của môn Đại số tuyến tính (Trục Subject)" giờ đây được giải quyết và trả kết quả lên màn hình chỉ trong vài tích tắc, tối đa hóa thời gian tiếp thu tri thức thực sự của người học.

### 3.5.2. Kỹ thuật Render Chế độ Tối (Dark Mode) qua Biến CSSOM
Nhận thức được thói quen làm việc muộn vào ban đêm của kỹ sư và sinh viên các khối ngành kỹ thuật chuyên sâu, tính năng Chế độ Sáng/Tối (Light/Dark Theme) được định vị là một tính năng UX cốt lõi (Core Utility) chứ không phải là một hiệu ứng bề nổi thẩm mỹ.

**Ghi đè Bộ máy tính toán kiểu dáng (CSS Object Model Override):**
Thay vì thiết kế hệ thống theo chuẩn cũ (duy trì hai tệp `.css` khổng lồ riêng biệt và hoán đổi link tag gây chớp màn hình - FOUC), hệ thống vận dụng toàn bộ sức mạnh của CSS Custom Properties (Biến CSS) kết hợp với thuộc tính cấp độ gốc `data-bs-theme` của Bootstrap. Mọi thông số về bảng màu, độ bóng, độ đục đều được trừu tượng hóa (Abstracted) thành các biến số:

```css
/* Trạng thái mặc định (Dark Mode) */
[data-bs-theme="dark"] {
    --bg-dark: #0f172a;               /* Màu nền không gian vũ trụ */
    --bg-panel: rgba(30, 41, 59, 0.7);/* Độ trong suốt của mặt kính */
    --text-main: #f8fafc;             /* Màu văn bản tương phản cao */
    /* ... */
}

/* Ghi đè trạng thái (Light Mode) */
[data-bs-theme="light"] {
    --bg-dark: #f8fafc;
    --bg-panel: rgba(255, 255, 255, 0.7);
    --text-main: #0f172a;
    /* ... */
}

/* Áp dụng biến toàn cục bằng CSSOM */
body {
    background-color: var(--bg-dark);
    color: var(--text-main);
    transition: background-color 0.3s ease, color 0.3s ease;
}
```

Khi sự kiện click đổi nền được kích hoạt trên thanh Navbar, JavaScript không phải thực hiện vòng lặp $O(N)$ để tìm và thay đổi thuộc tính `class` của hàng ngàn thẻ DOM đang hiển thị. Thay vào đó, nó thiết lập lại duy nhất một biến cục bộ `document.documentElement.setAttribute('data-bs-theme', newTheme)` với chi phí $O(1)$. 

Ngay lập tức, trình duyệt tự động kích hoạt quá trình Cập nhật Biểu đồ CSS (CSSOM Tree Update). Các thuộc tính con cháu phụ thuộc vào cụm biến (variables dependency) tự động được gán lại giá trị mới và nội suy (Interpolate) thay đổi theo đồ thị thời gian `transition: 0.3s ease` (sử dụng khả năng Tăng tốc Phần cứng - Hardware Acceleration của GPU để vẽ màu sắc mượt mà). Dữ liệu này đồng thời được lưu vào bộ nhớ không bay hơi (Persistent Memory) thông qua `localStorage` để duy trì ngữ cảnh ở những lần truy cập sau.

**Tính đáp ứng hoàn hảo trên đa nền tảng (Responsive Layout):**
Dựa trên hệ thống Grid Flexbox của Bootstrap, giao diện phân chia lãnh thổ thị giác theo tỷ lệ vàng:
- Trên Môi trường Máy tính (Desktop/Laptop), Bảng điều khiển bộ lọc (Sidebar) được cấp 25% diện tích không gian tĩnh bên trái (`col-lg-3`). Điều kiện biên này đảm bảo sinh viên liên tục có quyền truy cập bộ công cụ điều khiển ngữ cảnh mà không phải phân tâm cuộn (scroll) ngược lên đầu trang.
- Cơ chế Giảm cấp tinh tế (Graceful Degradation): Khi trình duyệt dò tìm thấy kích thước Viewport hạ xuống dưới ngưỡng an toàn 992px (Breakpoint thiết bị Mobile/Tablet), hệ thống kích hoạt tự vệ phòng thủ. Cột Sidebar bị triệt tiêu hiển thị (`d-none`), nhường toàn bộ 100% diện tích màn hình eo hẹp cho nội dung hiển thị cốt lõi (các phương trình vi phân và giới hạn phức tạp rất kỵ việc bị ép ngắt dòng chữ). Chức năng lọc được đóng gói vào một khoang phụ trợ Canvas ngoài rìa (Offcanvas sidebar), được triệu hồi bằng một nút nhấn vật lý chuyên dụng. Tư duy thiết kế "Mobile-First" này vay mượn trải nghiệm mượt mà từ các ứng dụng hệ điều hành iOS/Android nguyên bản, bảo vệ mắt và nâng tầm sự tập trung của sinh viên ở mức độ cao nhất.
