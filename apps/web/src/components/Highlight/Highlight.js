import PropTypes from 'prop-types'
import React from 'react'
import { flatten } from 'lodash/fp'

/**
 * Highlight component - Safely highlights search terms in content
 * 
 * Security Note: This component has been refactored to avoid XSS vulnerabilities.
 * It now uses React elements instead of string-based HTML construction.
 */
export default class Highlight extends React.Component {
  static propTypes = {
    children: PropTypes.element,
    className: PropTypes.string,
    component: PropTypes.any,
    highlightClassName: PropTypes.string
  }

  static defaultProps = {
    component: 'span',
    highlightClassName: 'highlight'
  }

  parseCounter = 0

  /**
   * Escape special regex characters in a string
   */
  escapeRegex (string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  getMatches (string) {
    const terms = this.props.terms.map(term =>
      term.replace(/\W/g, ''))

    const matches = []
    for (const i in terms) {
      if (!terms[i]) continue // Skip empty terms
      const regex = new RegExp(`\\b${this.escapeRegex(terms[i])}\\b`, 'ig')
      let match
      while ((match = regex.exec(string)) !== null) {
        matches.push(match)
      }
    }
    return matches
  }

  parseString (string) {
    // takes a plain string and returns react elements
    const elements = []
    if (string === '') {
      return elements
    }

    const matches = this.getMatches(string)

    let lastIndex = 0
    matches.forEach((match, i) => {
      const text = match[0]
      const { index } = match
      if (index > lastIndex) {
        elements.push(string.substring(lastIndex, index))
      }

      const props = {
        key: `parse${this.parseCounter}match${i}`,
        className: this.props.highlightClassName
      }

      elements.push(React.createElement(
        this.props.component,
        props,
        text
      ))

      lastIndex = index + text.length
    })

    if (lastIndex < string.length) {
      elements.push(string.substring(lastIndex))
    }

    return (elements.length === 1) ? elements[0] : elements
  }

  /**
   * Parse HTML string and return React elements
   * Uses DOMParser for safe HTML parsing (no string concatenation)
   */
  domParseHTMLString (html) {
    if (!html || typeof html !== 'string') return []
    
    // Use DOMParser for safe HTML parsing
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body
    
    const parsedDomTree = flatten(Array.from(body.childNodes).map(el => this.domParseNode(el)))
    return parsedDomTree
  }

  /**
   * Parse a DOM node and return React elements
   */
  domParseNode (node) {
    // takes a node and returns a React element or array of elements
    switch (node.nodeType) {
      case Node.TEXT_NODE: {
        // Text node - apply highlighting
        return this.parseString(node.textContent || '')
      }
      case Node.ELEMENT_NODE: {
        // Element node - recursively process children
        const children = flatten(Array.from(node.childNodes).map(child => this.domParseNode(child)))
        
        // Create React element with safe props
        const tagName = node.tagName.toLowerCase()
        
        // Only allow safe attributes
        const safeAttributes = ['class', 'href', 'target', 'rel', 'title', 'alt', 'src']
        const props = { key: `el${++this.parseCounter}` }
        
        safeAttributes.forEach(attr => {
          if (node.hasAttribute(attr)) {
            props[attr] = node.getAttribute(attr)
          }
        })
        
        // Add security attributes for links
        if (tagName === 'a' && props.href) {
          props.target = props.target || '_blank'
          props.rel = 'noopener noreferrer'
          
          // Validate href to prevent javascript: URLs
          if (props.href.match(/^javascript:/i)) {
            props.href = '#'
            props.onClick = (e) => e.preventDefault()
          }
        }
        
        return React.createElement(tagName, props, ...children)
      }
      default:
        return null
    }
  }

  parse (children) {
    let parsed = children

    if (typeof children === 'string') {
      parsed = this.parseString(children)
    } else if (React.isValidElement(children)) {
      if (children.props.dangerouslySetInnerHTML) {
        // Safely parse the HTML content instead of passing it through
        const originalHTML = children.props.dangerouslySetInnerHTML.__html
        const parsedElements = this.domParseHTMLString(originalHTML)
        
        // Clone the element without dangerouslySetInnerHTML
        const { dangerouslySetInnerHTML, ...safeProps } = children.props
        parsed = React.cloneElement(
          children,
          {
            ...safeProps,
            key: `parse${++this.parseCounter}`
          },
          parsedElements
        )
      } else {
        parsed = React.cloneElement(
          children,
          { key: `parse${++this.parseCounter}` },
          this.parse(children.props.children)
        )
      }
    } else if (children instanceof Array) {
      parsed = children.map(child => {
        return this.parse(child)
      })
    }

    return parsed
  }

  render () {
    const { children, className, terms = [] } = this.props

    let parsedChildren = children

    if (terms.length === 0) {
      return children
    }

    this.parseCounter = 0
    parsedChildren = this.parse(children)

    return <span className={className}>{parsedChildren}</span>
  }
}
