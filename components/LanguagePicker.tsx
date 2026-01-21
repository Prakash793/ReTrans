
import React from 'react';
import { LANGUAGES } from '../constants';

interface LanguagePickerProps {
  value: string;
  onChange: (value: string) => void;
}

const LanguagePicker: React.FC<LanguagePickerProps> = ({ value, onChange }) => {
  return (
    <select 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border-none focus:ring-0 font-semibold text-lg cursor-pointer hover:text-indigo-600 transition-colors"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
};

export default LanguagePicker;
