'use client';

export function StartDemoButton() {
  function start() {
    localStorage.setItem('storyActive', 'true');
    localStorage.setItem('storyStep', '1');
    window.location.href = '/?story=1';
  }
  return (
    <button
      onClick={start}
      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm transition-colors font-semibold"
    >
      ▶ Start Demo
    </button>
  );
}
