addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });
  
  async function handleRequest(request) {
    const domains = DOMAIN_NAMES.split(','); // 从环境变量获取多个域名
  
    try {
        // 存储每个域名的查询结果
        const results = await Promise.all(domains.map(async (domain) => {
            // 去除域名两端的空格
            domain = domain.trim();
  
            try {
                // 使用 fetch 调用 whois.vu API 服务来查询域名信息
                const response = await fetch(`https://api.whois.vu/?q=${domain}`);
                const data = await response.json();
  
                // 检查 API 返回的数据是否包含 'expires' 字段
                if (!data.expires) {
                    throw new Error(`API response for ${domain} does not contain an "expires" field`);
                }
  
                // 解析 'expires' 字段（Unix 时间戳）
                const expiryDate = new Date(data.expires * 1000); // 将 Unix 时间戳转换为毫秒
                if (isNaN(expiryDate.getTime())) {
                    throw new Error(`Invalid expiry date format for ${domain}`);
                }
  
                const currentDate = new Date();
                const remainingDays = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
  
                // 格式化日期为 YYYY.M.D
                const formattedExpiryDate = `${expiryDate.getFullYear()}.${expiryDate.getMonth() + 1}.${expiryDate.getDate()}`;
  
                return {
                    domain,
                    expiryDate: formattedExpiryDate,
                    remainingDays
                };
            } catch (error) {
                console.error(`Error fetching or parsing WHOIS data for ${domain}:`, error);
                return {
                    domain,
                    expiryDate: '--',
                    remainingDays: '--'
                };
            }
        }));
  
        // 构建 HTML 响应
        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>域名到期监测</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            background-color: #f4f4f4;
                            user-select: none; /* 禁止选中 */
                        }
                        .container {
                            text-align: center;
                            padding-top: 50px;
                        }
                        table {
                            border-collapse: collapse;
                            width: 70%;
                            margin: 20px auto;
                            background-color: white;
                            table-layout: fixed; /* 每列宽度相等 */
                        }
                        th, td {
                            border: 1px solid #dddddd;
                            text-align: center;
                            padding: 8px;
                            word-wrap: break-word; /* 单词换行 */
                        }
                        th {
                            cursor: pointer;
                            background-color: #f2f2f2;
                        }
                        th:hover {
                            background-color: #ddd;
                        }
                        h1 {
                            text-align: center;
                            margin-top: 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>域名到期监测</h1>
                        <table id="domainTable">
                            <thead>
                                <tr>
                                    <th onclick="sortTable(0)">域名</th>
                                    <th onclick="sortTable(1)">到期时间</th>
                                    <th onclick="sortTable(2)">剩余天数</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${results.map(result => `
                                    <tr>
                                        <td>${result.domain}</td>
                                        <td>${result.expiryDate}</td>
                                        <td>${result.remainingDays}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <script>
                        let sortDirection = [true, true, true]; // 初始排序方向：true 表示升序，false 表示降序
  
                        function sortTable(n) {
                            const table = document.getElementById("domainTable");
                            let switching = true, shouldSwitch;
                            let rows, i;
                            let dir = sortDirection[n] ? "asc" : "desc";
                            sortDirection[n] = !sortDirection[n];
                        
                            while (switching) {
                                switching = false;
                                rows = table.rows;
                                for (i = 1; i < (rows.length - 1); i++) {
                                    shouldSwitch = false;
                                    let x = rows[i].getElementsByTagName("TD")[n];
                                    let y = rows[i + 1].getElementsByTagName("TD")[n];
                        
                                    // 用于比较的值
                                    let xVal = x.innerHTML.toLowerCase();
                                    let yVal = y.innerHTML.toLowerCase();
                        
                                    // 检查是否是日期或数字，并进行适当转换
                                    if (n === 1) { // 日期列
                                        xVal = parseDate(xVal);
                                        yVal = parseDate(yVal);
                                    } else if (n === 2) { // 数字列
                                        xVal = parseInt(xVal, 10);
                                        yVal = parseInt(yVal, 10);
                                    }
                        
                                    // 进行比较
                                    if ((dir === "asc" && xVal > yVal) || (dir === "desc" && xVal < yVal)) {
                                        shouldSwitch = true;
                                        break;
                                    }
                                }
                                if (shouldSwitch) {
                                    rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                                    switching = true;
                                }
                            }
                        }
                        
                        function parseDate(dateStr) {
                            const parts = dateStr.split(".");
                            return new Date(parts[0], parts[1] - 1, parts[2]); // 月份从0开始，所以需要减1
                        }            
                        
                    </script>
                </body>
            </html>
        `;
  
        return new Response(html, {
            headers: { 'content-type': 'text/html; charset=UTF-8' },
        });
    } catch (error) {
        console.error('Error fetching or parsing WHOIS data:', error);
  
        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>域名到期监测</title>
                </head>
                <body>
                    <h1>域名到期监测</h1>
                    <p>错误: ${error.message}</p>
                </body>
            </html>
        `;
  
        return new Response(html, {
            headers: { 'content-type': 'text/html; charset=UTF-8' },
        });
    }
  }