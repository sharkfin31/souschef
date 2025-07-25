import { useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { GroceryList as GroceryListType } from '../types/recipe';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: GroceryListType[];
  onShare: (listIds: string[]) => Promise<void>;
}

const ShareListsModal = ({ isOpen, onClose, lists, onShare }: ShareModalProps) => {
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectList = (listId: string) => {
    setSelectedLists(prev => 
      prev.includes(listId)
        ? prev.filter(id => id !== listId)
        : [...prev, listId]
    );
  };

  const handleShare = async () => {
    if (selectedLists.length === 0) {
      setError('Please select at least one list to share');
      return;
    }

    setError(null);
    setSharing(true);

    try {
      await onShare(selectedLists);
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to share lists');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Select Lists to Share</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500">
            <FaXmark size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="mb-4">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {lists.map(list => (
              <div 
                key={list.id} 
                className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                onClick={() => handleSelectList(list.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedLists.includes(list.id)}
                  onChange={() => {}} // Handled by div click
                  className="mr-2"
                />
                <span className="flex-1">{list.name}</span>
                <span className="text-xs text-gray-500 ml-2">({list.items.length} items)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 mr-2"
            disabled={sharing}
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:bg-gray-400"
            disabled={sharing || selectedLists.length === 0}
          >
            {sharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareListsModal;
