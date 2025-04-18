import { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./App.css";

const CONTRACT_ADDRESS = "0xD18D73850aA841D7B63d31333b7b68458210E8A1";
const ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint amount)"
];

function App() {
  const [wallet, setWallet] = useState(null);
  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [balance, setBalance] = useState("0");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [transfers, setTransfers] = useState([]);

  async function connectWallet() {
    if (window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(accounts[0]);
      await loadTokenInfo();
    } else {
      alert("الرجاء تثبيت محفظة MetaMask");
    }
  }

  async function loadTokenInfo() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    setTokenName(await contract.name());
    setSymbol(await contract.symbol());
  }

  async function getBalance() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    const bal = await contract.balanceOf(wallet);
    setBalance(ethers.utils.formatUnits(bal, 18));
  }

  async function sendTokens() {
    try {
      setStatus("جاري التحويل...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      const tx = await contract.transfer(recipient, ethers.utils.parseUnits(amount, 18));
      await tx.wait();
      setStatus("✅ تم التحويل بنجاح!");
      getBalance();
      loadTransfers(wallet, setTransfers);
    } catch (error) {
      setStatus("❌ خطأ: " + error.message);
    }
  }

  async function addTokenToWallet() {
    try {
      const wasAdded = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: CONTRACT_ADDRESS,
            symbol: symbol || "EID",
            decimals: 18,
            image: "https://cryptologos.cc/logos/ethereum-eth-logo.png"
          }
        }
      });
      if (wasAdded) {
        console.log("✅ تمت إضافة التوكن إلى MetaMask");
      } else {
        console.log("❌ تم إلغاء الإضافة من المستخدم");
      }
    } catch (error) {
      console.error("خطأ أثناء الإضافة:", error);
    }
  }

  async function loadTransfers(wallet, setTransfers) {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    const filterFrom = contract.filters.Transfer(wallet, null);
    const filterTo = contract.filters.Transfer(null, wallet);

    const [sentEvents, receivedEvents] = await Promise.all([
      contract.queryFilter(filterFrom, -10000),
      contract.queryFilter(filterTo, -10000)
    ]);

    const all = [...sentEvents, ...receivedEvents]
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, 10);

    const mapped = all.map((event) => ({
      from: event.args.from,
      to: event.args.to,
      amount: ethers.utils.formatUnits(event.args.amount, 18),
      tx: event.transactionHash
    }));

    setTransfers(mapped);
  }

  useEffect(() => {
    if (wallet) {
      getBalance();
      loadTransfers(wallet, setTransfers);
    }
  }, [wallet]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white shadow-xl rounded-2xl p-6 max-w-md w-full space-y-4">
        <h1 className="text-xl font-bold text-center">
          {tokenName || "Token"} ({symbol})
        </h1>

        <button onClick={connectWallet} className="w-full bg-blue-600 text-white py-2 rounded-xl">
          {wallet ? "متصل: " + wallet.slice(0, 6) + "..." : "اتصل بالمحفظة"}
        </button>

        {wallet && (
          <div className="space-y-3">
            <p className="text-center">💰 الرصيد: {balance} {symbol}</p>

            <button
              onClick={() => loadTransfers(wallet, setTransfers)}
              className="w-full bg-gray-200 text-sm py-1 rounded"
            >
              🔄 تحديث سجل التحويلات
            </button>

            {transfers.length > 0 && (
              <div className="text-sm bg-gray-50 border rounded p-2">
                <h2 className="font-semibold mb-2">📜 سجل التحويلات</h2>
                <ul className="space-y-1 max-h-52 overflow-auto">
                  {transfers.map((tx, index) => (
                    <li key={index} className="border-b py-1">
                      <div>
                        <strong>من:</strong> {tx.from.slice(0, 6)}... → <strong>إلى:</strong> {tx.to.slice(0, 6)}...
                      </div>
                      <div><strong>الكمية:</strong> {tx.amount} {symbol}</div>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${tx.tx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 underline"
                      >
                        عرض المعاملة
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <input
              type="text"
              placeholder="عنوان المستلم"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full border p-2 rounded"
            />

            <input
              type="number"
              placeholder="الكمية"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border p-2 rounded"
            />

            <button onClick={sendTokens} className="w-full bg-green-600 text-white py-2 rounded-xl">
              إرسال التوكنات
            </button>

            <button onClick={addTokenToWallet} className="w-full bg-yellow-400 text-black py-2 rounded-xl">
              ➕ إضافة التوكن إلى MetaMask
            </button>

            {status && <p className="text-center text-sm text-gray-700">{status}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
