export async function request(path, options = {}) {
  const response = await fetch(`/api/${path}`, {...options, headers:{'Content-Type':'application/json', ...options.headers}});
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '本地数据读取失败');
  return body;
}
