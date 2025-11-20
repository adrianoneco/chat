export function Logo({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const sizeClasses = {
    small: "w-12 h-12",
    default: "w-16 h-16",
    large: "w-20 h-20",
  };

  const iconSizeClasses = {
    small: "w-6 h-6",
    default: "w-8 h-8",
    large: "w-10 h-10",
  };

  const textSizeClasses = {
    small: "text-2xl",
    default: "text-3xl",
    large: "text-5xl md:text-6xl",
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`inline-flex items-center justify-center ${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 backdrop-blur-xl shadow-lg`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${iconSizeClasses[size]} text-white drop-shadow-lg`}
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>
        </svg>
      </div>
      <h1 className={`${textSizeClasses[size]} font-bold text-white text-center`}>
        ChatApp
      </h1>
    </div>
  );
}
