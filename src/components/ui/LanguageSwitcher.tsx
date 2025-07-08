'use client';

import React, { useState } from 'react';
import { useI18n, useTranslation, Locale } from '@/lib/i18n/provider';
import { localeConfig } from '../../../i18n/routing';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Globe, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'compact' | 'icon-only';
}

export function LanguageSwitcher({ 
  className = '', 
  showLabel = true,
  variant = 'default' 
}: LanguageSwitcherProps) {
  const { locale, setLocale, direction } = useI18n();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLocaleConfig = localeConfig[locale];
  const availableLocales = Object.keys(localeConfig) as Locale[];

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
    
    // Announce the change to screen readers
    const announcement = t('accessibility.languageChanged', { 
      language: localeConfig[newLocale].nativeLabel 
    });
    
    if (typeof window !== 'undefined') {
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      liveRegion.textContent = announcement;
      document.body.appendChild(liveRegion);
      
      setTimeout(() => {
        document.body.removeChild(liveRegion);
      }, 1000);
    }
  };

  const getButtonContent = () => {
    switch (variant) {
      case 'icon-only':
        return (
          <div className="flex items-center justify-center">
            <Globe className="h-4 w-4" />
          </div>
        );
      case 'compact':
        return (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">
              {currentLocaleConfig.flag}
            </span>
            <span className="text-sm">
              {currentLocaleConfig.nativeLabel}
            </span>
            <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span className="text-sm font-medium">
              {currentLocaleConfig.flag} {currentLocaleConfig.nativeLabel}
            </span>
            {showLabel && (
              <span className="hidden sm:inline text-xs text-gray-500">
                ({t('common.language')})
              </span>
            )}
            <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        );
    }
  };

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className={`
            inline-flex items-center justify-center rounded-md px-3 py-2 text-sm
            ring-offset-background transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            disabled:pointer-events-none disabled:opacity-50
            border border-input bg-background hover:bg-accent hover:text-accent-foreground
            group
            ${className}
          `}
          aria-label={t('accessibility.changeLanguage')}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          dir={direction}
        >
          {getButtonContent()}
        </button>
      </DropdownMenu.Trigger>

      <AnimatePresence>
        {isOpen && (
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[200px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              sideOffset={5}
              align={direction === 'rtl' ? 'end' : 'start'}
              dir={direction}
              asChild
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  {t('settings.general.language')}
                </div>
                
                <DropdownMenu.Separator className="my-1 h-px bg-muted" />
                
                <div className="space-y-1">
                  {availableLocales.map((localeOption) => {
                    const config = localeConfig[localeOption];
                    const isSelected = localeOption === locale;
                    
                    return (
                      <DropdownMenu.Item
                        key={localeOption}
                        className={`
                          relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm
                          outline-none transition-colors
                          hover:bg-accent hover:text-accent-foreground
                          focus:bg-accent focus:text-accent-foreground
                          data-[disabled]:pointer-events-none data-[disabled]:opacity-50
                          ${isSelected ? 'bg-accent text-accent-foreground' : ''}
                        `}
                        onClick={() => handleLocaleChange(localeOption)}
                        dir={config.rtl ? 'rtl' : 'ltr'}
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <span className="text-lg">{config.flag}</span>
                          <div className="flex-1">
                            <div className="font-medium">{config.nativeLabel}</div>
                            <div className="text-xs text-muted-foreground">
                              {config.label}
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-accent-foreground" />
                          )}
                        </div>
                      </DropdownMenu.Item>
                    );
                  })}
                </div>
                
                <DropdownMenu.Separator className="my-1 h-px bg-muted" />
                
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {t('settings.general.languageNote', { 
                    total: availableLocales.length 
                  })}
                </div>
              </motion.div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        )}
      </AnimatePresence>
    </DropdownMenu.Root>
  );
}

// Compact version for mobile/tight spaces
export function LanguageSwitcherCompact(props: Omit<LanguageSwitcherProps, 'variant'>) {
  return <LanguageSwitcher {...props} variant="compact" />;
}

// Icon-only version for minimal UI
export function LanguageSwitcherIcon(props: Omit<LanguageSwitcherProps, 'variant'>) {
  return <LanguageSwitcher {...props} variant="icon-only" showLabel={false} />;
}