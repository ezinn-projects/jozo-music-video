// import { TrendingSong } from "./types";

// Default fallback video ID for audio-only playback when no song is selected
// This video will be completely hidden using CSS, only audio will be played to save bandwidth
// Video ID: dg1_0zCosRw - optimized for small quality to minimize data usage
export const FALLBACK_VIDEO_ID = "dg1_0zCosRw";

// Alternative lightweight video options for fallback (commented out):
// export const FALLBACK_VIDEO_ID = "dQw4w9WgXcQ"; // Rick Roll - classic lightweight option
// export const FALLBACK_VIDEO_ID = "oHg5SJYRHA0"; // Never Gonna Give You Up - another lightweight choice

// TODO: Consider implementing a dedicated audio player component for audio-only fallback
// This would eliminate the need for YouTube iframe entirely and provide better performance

// Cute messages to display when waiting for a song
export const CUTE_MESSAGES = [
  "Chúc các sĩ tử thi tốt nha! Sau khi thi xong quẩy cùng Jozo nào! 🎉",
  "Thi cử căng thẳng quá, nghỉ xíu rồi quậy tung với Jozo! 🎵",
  "Sĩ tử ơi, học mệt rồi thì thư giãn cùng Jozo nè! 🧀",
  "Thi xong rồi thì quẩy banh nóc cùng Jozo nha! 👀",
  "Jozo tin bạn sẽ thi thật tốt! Chọn bài để ăn mừng thôi! 💃",
  "Sĩ tử cố lên! Jozo đang chuẩn bị playlist quẩy tưng bừng đây! ✨",
  "Học hành mệt mỏi, thư giãn xíu với Jozo rồi chiến tiếp! 🎶",
  "Thi cử áp lực quá! Relax cùng Jozo một chút rồi học tiếp nha! 🥺",
  "Sĩ tử ơi, thi tốt rồi cùng Jozo phá đảo âm nhạc nào! 🎧",
  "Jozo chúc các sĩ tử thi thật đỉnh! Sau đó quẩy tung trời luôn! 🎉",
  "Thi cử là tạm thời, quẩy cùng Jozo là mãi mãi! Cố lên nha! 🌟",
  "Sĩ tử ơi, Jozo đang chuẩn bị bữa tiệc âm nhạc để ăn mừng đây! 🎸",
  "Học xong, thi xong, là quẩy banh nóc cùng Jozo thôi! 🎪",
  "Jozo tin bạn sẽ làm được! Chọn bài để thư giãn não bộ nào! 💫",
  "Sĩ tử cố lên! Jozo đang đợi để cùng bạn quẩy tưng bừng sau khi thi! 💝",
];

// Trending songs list
export const TRENDING_SONGS = [
  // Mùa hè
  {
    title: "Thanh Xuân Của Chúng Ta",
    artist: "Chillies x Grey D",
    views: "12.5M",
    genre: "Mùa hè",
    category: "summer",
    description: "Rực rỡ, phóng khoáng, nhiều năng lượng",
  },
  {
    title: "Đi Để Trở Về",
    artist: "Soobin Hoàng Sơn",
    views: "15.8M",
    genre: "Mùa hè",
    category: "summer",
    description: "Hành trình trở về",
  },
  {
    title: "Hè Vô Lý",
    artist: "Suni Hạ Linh x Obito x Hậu Hoàng",
    views: "8.9M",
    genre: "Mùa hè",
    category: "summer",
    description: "Mùa hè sôi động",
  },
  {
    title: "Vì Em Quá Yêu Anh",
    artist: "Only C",
    views: "7.2M",
    genre: "Mùa hè",
    category: "summer",
    description: "Tình yêu mùa hè",
  },
  {
    title: "Tình Bạn Diệu Kỳ",
    artist: "AMEE x Ricky Star x Lăng LD",
    views: "9.4M",
    genre: "Mùa hè",
    category: "summer",
    description: "Tình bạn đẹp",
  },
  {
    title: "Đã Đến Lúc",
    artist: "Soobin Hoàng Sơn",
    views: "6.8M",
    genre: "Mùa hè",
    category: "summer",
    description: "Chia tay tuổi học trò",
  },
  {
    title: "Cùng Anh",
    artist: "Ngọc Dolil x Hagi x STee",
    views: "5.9M",
    genre: "Mùa hè",
    category: "summer",
    description: "Tình yêu mùa hè",
  },
  {
    title: "Lạ Lùng",
    artist: "Vũ",
    views: "11.2M",
    genre: "Mùa hè",
    category: "summer",
    description: "Chiều hè mộng mơ",
  },
  {
    title: "Tháng Mấy Em Nhớ Anh",
    artist: "Hà Anh Tuấn",
    views: "8.3M",
    genre: "Mùa hè",
    category: "summer",
    description: "Nỗi nhớ mùa hè",
  },
  {
    title: "Summer Time",
    artist: "Kimmese",
    views: "6.5M",
    genre: "Mùa hè",
    category: "summer",
    description: "R&B mùa hè",
  },
  {
    title: "Có Em Chờ",
    artist: "MIN x Mr.A",
    views: "18.7M",
    genre: "Mùa hè",
    category: "summer",
    description: "Tình yêu mùa hè sôi động",
  },
  {
    title: "Hơn Cả Yêu",
    artist: "Đức Phúc",
    views: "15.3M",
    genre: "Mùa hè",
    category: "summer",
    description: "Cảm xúc mùa hè rực rỡ",
  },
  {
    title: "Chạy Ngay Đi",
    artist: "Sơn Tùng M-TP",
    views: "22.5M",
    genre: "Mùa hè",
    category: "summer",
    description: "Hit mùa hè bùng nổ",
  },
  {
    title: "Hãy Trao Cho Anh",
    artist: "Sơn Tùng M-TP x Snoop Dogg",
    views: "25.8M",
    genre: "Mùa hè",
    category: "summer",
    description: "Bản hit quốc tế mùa hè",
  },
  {
    title: "Sóng Gió",
    artist: "Jack x K-ICM",
    views: "30.2M",
    genre: "Mùa hè",
    category: "summer",
    description: "Hiện tượng âm nhạc mùa hè",
  },

  // Cuối năm học
  {
    title: "Mình Cùng Nhau Đóng Băng",
    artist: "Thùy Chi x Đen Vâu",
    views: "14.3M",
    genre: "Cuối năm",
    category: "school",
    description: "Chia tay, hoài niệm",
  },
  {
    title: "Dài Lý",
    artist: "Thành Hương",
    views: "12.7M",
    genre: "Cuối năm",
    category: "school",
    description: "Kỷ niệm tuổi học trò",
  },
  {
    title: "Năm Tháng Học Trò",
    artist: "Thiên Hưng",
    views: "25.3M",
    genre: "Cuối năm",
    category: "school",
    description: "Kỷ niệm tuổi học trò",
  },
  {
    title: "Tạm Biệt Nhé",
    artist: "Lynk Lee x Phúc Bồ",
    views: "9.1M",
    genre: "Cuối năm",
    category: "school",
    description: "Lời tạm biệt",
  },
  {
    title: "Xe Đạp",
    artist: "Thùy Chi x M4U",
    views: "7.5M",
    genre: "Cuối năm",
    category: "school",
    description: "Kỷ niệm tuổi học trò",
  },
  {
    title: "Những Gì Anh Nói",
    artist: "Phan Mạnh Quỳnh",
    views: "8.3M",
    genre: "Cuối năm",
    category: "school",
    description: "Tiếc nuối thanh xuân",
  },
  {
    title: "Tớ Thích Cậu",
    artist: "Han Sara",
    views: "6.2M",
    genre: "Cuối năm",
    category: "school",
    description: "Tình cảm học trò",
  },
  {
    title: "Nơi Ta Chờ Em",
    artist: "Will x Kaity Nguyễn",
    views: "5.7M",
    genre: "Cuối năm",
    category: "school",
    description: "Chờ đợi thanh xuân",
  },
  {
    title: "Tháng Năm Không Quên",
    artist: "Hứa Kim Tuyền x Orange x GREY D",
    views: "10.4M",
    genre: "Cuối năm",
    category: "school",
    description: "Kỷ niệm không quên",
  },
  {
    title: "Chuyến Xe Thanh Xuân",
    artist: "Da LAB",
    views: "9.8M",
    genre: "Cuối năm",
    category: "school",
    description: "Hành trình thanh xuân",
  },
  {
    title: "Năm Ấy",
    artist: "Đức Phúc",
    views: "7.1M",
    genre: "Cuối năm",
    category: "school",
    description: "Nhớ về năm tháng đã qua",
  },
  {
    title: "Hồi Ức",
    artist: "Ngọt",
    views: "11.6M",
    genre: "Cuối năm",
    category: "school",
    description: "Kỷ niệm tháng năm",
  },
  {
    title: "Đêm Cuối Năm",
    artist: "Andiez",
    views: "11.6M",
    genre: "Cuối năm",
    category: "school",
    description: "Kỷ niệm tháng năm",
  },
];
