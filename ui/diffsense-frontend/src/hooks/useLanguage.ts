import { useState, useEffect } from 'react';
import { supportedLanguages, type SupportedLanguage, type LanguageConfig } from '../i18n/languages';
import { saveState, getState } from '../utils/vscode';

const LANGUAGE_STORAGE_KEY = 'diffsense_language';

export const useLanguage = () => {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>('zh-CN');
  const [config, setConfig] = useState<LanguageConfig>(supportedLanguages['zh-CN']);

  // 初始化语言设置
  useEffect(() => {
    const savedState = getState();
    const savedLanguage = savedState[LANGUAGE_STORAGE_KEY] as SupportedLanguage;
    
    if (savedLanguage && supportedLanguages[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
      setConfig(supportedLanguages[savedLanguage]);
    } else {
      // 尝试从浏览器语言检测
      const browserLanguage = navigator.language;
      let detectedLanguage: SupportedLanguage = 'zh-CN';
      
      if (browserLanguage.startsWith('en')) {
        detectedLanguage = 'en-US';
      } else if (browserLanguage.startsWith('zh')) {
        detectedLanguage = 'zh-CN';
      }
      
      setCurrentLanguage(detectedLanguage);
      setConfig(supportedLanguages[detectedLanguage]);
      
      // 保存检测到的语言
      saveLanguage(detectedLanguage);
    }
  }, []);

  // 保存语言设置
  const saveLanguage = (language: SupportedLanguage) => {
    const currentState = getState();
    const newState = {
      ...currentState,
      [LANGUAGE_STORAGE_KEY]: language
    };
    saveState(newState);
  };

  // 切换语言
  const changeLanguage = (language: SupportedLanguage) => {
    if (supportedLanguages[language]) {
      setCurrentLanguage(language);
      setConfig(supportedLanguages[language]);
      saveLanguage(language);
      
      console.log('🌐 切换语言到:', language);
    }
  };

  // 获取当前语言的文本
  const t = (keyPath: string): string => {
    const keys = keyPath.split('.');
    let value: any = config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        console.warn(`Translation key not found: ${keyPath}`);
        return keyPath; // 返回键名作为fallback
      }
    }
    
    return typeof value === 'string' ? value : keyPath;
  };

  return {
    currentLanguage,
    config,
    changeLanguage,
    t,
    supportedLanguages: Object.keys(supportedLanguages) as SupportedLanguage[]
  };
}; 