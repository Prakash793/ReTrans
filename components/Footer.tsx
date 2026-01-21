
import React from 'react';
import { APP_NAME } from '../constants';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 mt-20 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-4">
            <h3 className="font-lexend font-bold text-xl">{APP_NAME}</h3>
            <p className="text-sm text-slate-500">
              Next-generation document translation for the modern enterprise. Powered by Gemini.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="text-sm text-slate-500 space-y-2">
              <li><a href="#" className="hover:text-indigo-600">Features</a></li>
              <li><a href="#" className="hover:text-indigo-600">File Types</a></li>
              <li><a href="#" className="hover:text-indigo-600">Languages</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="text-sm text-slate-500 space-y-2">
              <li><a href="#" className="hover:text-indigo-600">Documentation</a></li>
              <li><a href="#" className="hover:text-indigo-600">Security</a></li>
              <li><a href="#" className="hover:text-indigo-600">Privacy Policy</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="text-sm text-slate-500 space-y-2">
              <li><a href="#" className="hover:text-indigo-600">About Us</a></li>
              <li><a href="#" className="hover:text-indigo-600">Contact</a></li>
              <li><a href="#" className="hover:text-indigo-600">Sales</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} ReTrans Intelligence. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-indigo-600">Terms of Service</a>
            <a href="#" className="hover:text-indigo-600">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600">Cookie Settings</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
