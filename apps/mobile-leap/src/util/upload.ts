import apiHost from './apiHost'

type UploadFile = {
  uri: string
  name?: string
  type?: string
}

export async function uploadFile (type: string, id: string, file: UploadFile) {
  const formData = new FormData()
  formData.append('type', type)
  formData.append('id', id || 'new')
  formData.append('file', {
    uri: file.uri,
    name: file.name ?? 'upload.jpg',
    type: file.type ?? 'image/jpeg'
  } as unknown as Blob)

  const response = await fetch(`${apiHost}/noo/upload`, {
    method: 'POST',
    body: formData
  })

  const text = await response.text()
  if (response.status === 200) {
    return JSON.parse(text) as { url: string }
  }

  let message = text
  try {
    message = JSON.parse(text).message
  } catch {
    // keep raw text
  }
  throw new Error(message || 'Upload failed')
}
