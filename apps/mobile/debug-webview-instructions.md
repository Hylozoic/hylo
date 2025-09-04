# WebView Debugging Instructions

## Method 1: Debug Buttons (Recommended)
In development mode, you'll see debug buttons in the top-right corner of any WebView:
- 🔍 DIAGNOSE - Full content analysis
- 🔄 RELOAD - Force reload
- 🧪 TEST - Test connection

## Method 2: Metro Debugger Console

### Step 1: Expose WebView ref globally
Add this to any WebView component (temporarily):

```javascript
// Add this inside the component, after the webViewRef is created:
if (__DEV__) {
  global.currentWebViewRef = webViewRef
}
```

### Step 2: Open Metro debugger
- Press `Cmd+D` (iOS) or shake device (Android)
- Select "Debug with Chrome"
- Open Chrome DevTools Console

### Step 3: Run diagnosis
```javascript
// Full diagnosis
global.webViewDebugUtils.diagnoseWebView(global.currentWebViewRef)

// Test connection
global.webViewDebugUtils.testWebViewConnection(global.currentWebViewRef)

// Manual content check
global.webViewDebugUtils.checkWebViewContent(global.currentWebViewRef)

// Force reload
global.webViewDebugUtils.reloadWebView(global.currentWebViewRef)

// Clear all WebView state
global.webViewDebugUtils.clearWebViewState()
```

## What to Look For

### Normal Working State:
```
"HyloWebView: Debug utilities loaded with LoadID: load_123..."
"HyloWebView: INITIAL_CONTENT_CHECK: { bodyLength: 15000, hasReactRoot: true, ... }"
```

### Broken State (Script Injection Failed):
```
"HyloWebView: No debug response, attempting manual injection..."
"HyloWebView: FALLBACK_CONTENT_CHECK: { fallbackInjection: true, ... }"
```

### Broken State (Content Issue):
```
"HyloWebView: DIAGNOSTIC RESULT: { issues: ['No React root element found'], ... }"
```

## Common Issues to Watch For:
- `bodyLength: 0` - Page loaded but empty
- `hasReactRoot: false` - React app didn't initialize  
- `title: "Hylo"` on chat pages - Generic title indicates rendering failure
- No debug messages at all - Custom script injection failed
