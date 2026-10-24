export const serverEnglish: Record<string, string> = {
  '只允许从本机访问扫描服务。': 'The scanning service is available only on this computer.',
  '已阻止来自其他网页的请求。': 'A request from another website was blocked.',
  '请求须使用 JSON 格式。': 'The request must use JSON.',
  '已有扫描进行中，请等待本轮完成。': 'A scan is already running. Please wait for it to finish.',
  '不支持此扫描来源。': 'This scan source is not supported.',
  '此来源插件已停用，请在插件设置中启用。':
    'This source plugin is disabled. Enable it in the plugin settings.',
  '扫描失败，请稍后重试。': 'The scan failed. Please try again.',
  '此接口不存在。': 'This API endpoint does not exist.',
  '请求数据过大。': 'The request is too large.',
  '请求格式不正确。': 'The request format is invalid.',
  '状态数据格式不正确。': 'The saved state format is invalid.',
  '项目数据无效，或项目数量超过 5,000。':
    'Project data is invalid, or there are more than 5,000 projects.',
  '项目 ID 不可重复。': 'Project IDs must be unique.',
  '设置数据格式不正确。': 'The settings format is invalid.',
  '本地数据文件无法读取，请检查 .data/state.json；原始文件已保留。':
    'Cannot read local data. Check .data/state.json; the original file has been preserved.',
  '无法保存本地数据，请检查目录写入权限。':
    'Cannot save local data. Check the directory write permissions.',
  服务返回了无法识别的响应: 'The service returned an unreadable response.',
  '操作失败，请稍后重试': 'The operation failed. Please try again.',
  '无法连接 GitHub，请检查网络后重试。':
    'Cannot connect to GitHub. Check your connection and try again.',
  'GitHub 用户或仓库不存在，或当前账号无权访问。':
    'The GitHub user or repository does not exist, or this account does not have access.',
  'GitHub 访问令牌无效或已过期，请更新后重试。':
    'The GitHub access token is invalid or expired. Update it and try again.',
  'GitHub 请求额度已用尽或访问受限；可稍后重试，或配置访问令牌。':
    'GitHub has limited this request or the API quota is exhausted. Try later or configure an access token.',
  'GitHub 暂时无法完成请求（{status}）。': 'GitHub could not complete the request (HTTP {status}).',
  '请输入有效的 GitHub 用户名。': 'Enter a valid GitHub username.',
  '本轮扫描已达到 120 秒上限，已保留获取到的仓库，列表可能不完整。':
    'The 120-second scan limit was reached. Found repositories are retained, but the list may be incomplete.',
  '本轮最多读取 1,000 个 GitHub 仓库，结果可能不完整。':
    'A scan can read up to 1,000 GitHub repositories. Results may be incomplete.',
  '{message} 已保留成功读取的仓库。':
    '{message} Successfully read repositories have been retained.',
  '本轮扫描已达到 120 秒上限；剩余仓库保留基本资料。':
    'The 120-second scan limit was reached. Basic details are retained for the remaining repositories.',
  '{name}：{message} 提交数标记为未知，沉寂日期暂用最后推送时间。':
    '{name}: {message} The commit count is unknown; the last push date is used for inactivity.',
  '从 GitHub 发现的 Fork 项目': 'A fork discovered on GitHub',
  '从 GitHub 发现的项目': 'A project discovered on GitHub',
  '部分仓库未能读取提交历史：提交数为未知，日期使用最后推送时间，废弃判断仅供参考。':
    'Some commit histories could not be read. Counts are unknown and dates use the last push; inactivity assessments are approximate.',
  '本次扫描仅包含此账号的公开仓库；读取自己的私有仓库需要配置访问令牌，并使用同一个账号的用户名。':
    'This scan includes only public repositories. To read your own private repositories, configure an access token and use the same account username.',
  未识别: 'Unknown',
  '{name} 尚无提交，日期使用目录创建时间。':
    '{name} has no commits yet. Dates use the directory creation time.',
  '无法读取 {name} 的 Git 历史，请检查 Git 安装及仓库访问权限。':
    'Cannot read the Git history of {name}. Check your Git installation and repository permissions.',
  '从本地 Git 历史发现的项目': 'A project discovered in local Git history',
  '请输入有效的绝对目录路径，例如 C:\\Projects。':
    'Enter a valid absolute directory path, such as C:\\Projects.',
  '扫描目录不存在或无法访问。': 'The scan directory does not exist or cannot be accessed.',
  '扫描深度须为 0 到 12 的整数。': 'Scan depth must be an integer from 0 to 12.',
  '扫描已达到本轮安全上限（20,000 个目录、1,000 个仓库或 120 秒），请缩小目录范围继续扫描。':
    'The scan limit was reached (20,000 directories, 1,000 repositories, or 120 seconds). Select a smaller directory to continue.',
  '跳过无权读取的目录：{directory}': 'Skipped a directory without read permission: {directory}',
  '只扫描到第 {depth} 层目录；更深的项目可通过调整深度或选择子目录扫描。':
    'Scanned up to {depth} directory levels. Increase the depth or select a subdirectory to find deeper projects.',
};
