import React from 'react';
import { FaExternalLinkAlt, FaWhatsapp, FaKey } from 'react-icons/fa';
import { FaXmark } from 'react-icons/fa6';

interface WhatsAppHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WhatsAppHelpModal: React.FC<WhatsAppHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center">
            <FaWhatsapp className="text-green-500 mr-2" />
            How to Get Your WhatsApp API Key
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaXmark size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <div className="flex items-center">
              <FaKey className="text-blue-400 mr-2" />
              <p className="text-sm text-blue-700">
                <strong>What is this?</strong> The WhatsApp API key allows SousChef to send your grocery lists directly to your WhatsApp.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Step-by-step instructions:</h4>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <p className="text-gray-700">
                    <strong>Add CallMeBot to WhatsApp:</strong> Send a WhatsApp message to <strong>+34 644 81 83 17</strong> with the text: 
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm ml-1">I allow callmebot to send me messages</code>
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <p className="text-gray-700">
                    <strong>Wait for confirmation:</strong> You'll receive a reply with your unique API key within a few minutes.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <p className="text-gray-700">
                    <strong>Copy your API key:</strong> The message will contain your API key (a long string of numbers and letters). Copy this key.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  4
                </div>
                <div>
                  <p className="text-gray-700">
                    <strong>Paste it here:</strong> Enter the API key in the field below to complete your registration.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <p className="text-sm text-yellow-700">
              <strong>Important:</strong> Keep your API key private and secure. Don't share it with anyone else.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="font-semibold text-gray-800 mb-2">Need more help?</h5>
            <p className="text-sm text-gray-600 mb-2">
              Visit the CallMeBot documentation for detailed instructions:
            </p>
            <a
              href="https://www.callmebot.com/blog/free-api-whatsapp-messages/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
            >
              CallMeBot WhatsApp API Documentation
              <FaExternalLinkAlt className="ml-1" size={12} />
            </a>
          </div>
        </div>
        
        <div className="flex justify-end p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppHelpModal;
