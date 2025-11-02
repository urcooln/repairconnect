// src/components/Navbar.js
function Navbar() {
  return (
    <nav className="flex items-center justify-between px-4 py-3 bg-gray-800 text-white">
      <button className="text-sm font-semibold bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
        Logout
      </button>
      <h2 className="text-lg font-bold">Repair Service</h2>
    </nav>
  );
}
export default Navbar;
