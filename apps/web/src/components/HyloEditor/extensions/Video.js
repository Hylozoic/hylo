import { Node, mergeAttributes } from '@tiptap/core'

const Video = Node.create({
  name: 'video',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,

  addAttributes () {
    return {
      src: {
        default: null
      },
      'data-type': {
        default: 'embed'
      }
    }
  },

  parseHTML () {
    return [
      {
        tag: 'video[data-type="embed"]'
      }
    ]
  },

  renderHTML ({ HTMLAttributes }) {
    return ['video', mergeAttributes({ 'data-type': 'embed', ...HTMLAttributes })]
  },

  addNodeView () {
    return ({ editor, node }) => {
      const div = document.createElement('div')
      div.className = `relative w-full aspect-video overflow-hidden my-4${editor.isEditable ? ' cursor-pointer' : ''}`

      const iframe = document.createElement('iframe')
      iframe.className = `absolute top-0 left-0 w-full h-full${editor.isEditable ? ' pointer-events-none' : ''}`
      iframe.width = '640'
      iframe.height = '360'
      iframe.frameBorder = '0'
      iframe.allowFullscreen = true
      iframe.src = node.attrs.src

      div.append(iframe)

      return {
        dom: div
      }
    }
  }
})

export default Video
