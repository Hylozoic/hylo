import apiHost from './apiHost'

type UploadFile = {
  uri: string
  name?: string
  type?: string
}

// Match apps/mobile upload: XMLHttpRequest + RN FormData { uri, name, type }.
// Expo fetch uses web FormData, which rejects that file shape ("formData" error).
export async function uploadFile (type: string, id: string, file: UploadFile) {
  const url = `${apiHost}/noo/upload`
  const filename = file.name || 'upload.jpg'
  const mimeType = file.type || 'image/jpeg'

  return new Promise<{ url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    formData.append('type', type)
    formData.append('id', id || 'new')
    formData.append('file', {
      uri: file.uri,
      name: filename,
      type: mimeType
    } as unknown as Blob)

    xhr.open('POST', url)
    xhr.onload = () => {
      const text = xhr.responseText || ''
      if (xhr.status === 200) {
        try {
          resolve(JSON.parse(text) as { url: string })
        } catch (err) {
          reject(err)
        }
        return
      }

      let message = text
      try {
        const parsed = JSON.parse(text)
        message = parsed.message || parsed.error || text
      } catch {
        // keep raw text
      }
      reject(new Error(message || 'Upload failed'))
    }
    xhr.onerror = () => {
      reject(new Error('Please check your network connection and try again.'))
    }
    xhr.send(formData)
  })
}
