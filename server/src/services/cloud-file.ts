// 云存储 fileID 解析与属主校验（ASR / 简历 / TTS 共用）
// 形态：cloud://<env>.<bucket>/<path>；只接受标准形态，解析失败一律拒绝。
// 属主约定（客户端上传 / 服务端写入共同遵守）：<topDir>/<uid>/…

export function isCloudFileID(fileID: string): boolean {
  return fileID.indexOf('cloud://') === 0
}

// 取 fileID 中的存储路径；非标准形态返回空串
export function cloudFilePath(fileID: string): string {
  if (!isCloudFileID(fileID)) return ''
  const rest = fileID.substring('cloud://'.length)
  const slash = rest.indexOf('/')
  if (slash <= 0 || slash >= rest.length - 1) return ''
  return rest.substring(slash + 1)
}

// 属主校验：路径必须以 <topDir>/<uid>/ 开头；uid 为空或路径不合规一律返回 false
export function isOwnedCloudFileID(fileID: string, uid: string, topDir: string): boolean {
  if (uid.length === 0) return false
  const path = cloudFilePath(fileID)
  if (path.length === 0) return false
  return path.indexOf(topDir + '/' + uid + '/') === 0
}
