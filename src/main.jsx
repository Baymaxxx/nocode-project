import ReactDOM from "react-dom/client";
import React from 'react';
import App from "./App.jsx";
import { NoCodeProvider } from "./contexts/NoCodeContext.jsx";
import "./index.css";

// 错误处理
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error('Global error:', msg, url, lineNo, columnNo, error);
  document.body.innerHTML = '<div style="padding: 20px; color: red;"><h2>应用加载错误</h2><pre>' + msg + '</pre></div>';
  return false;
};

// 创建根节点并渲染应用
try {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('Root element not found');
  }
  
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <NoCodeProvider>
        <App />
      </NoCodeProvider>
    </React.StrictMode>
  );
  
  console.log('App rendered successfully');
} catch (error) {
  console.error('Failed to render app:', error);
  document.body.innerHTML = '<div style="padding: 20px; color: red;"><h2>渲染失败</h2><pre>' + error.message + '</pre></div>';
}

