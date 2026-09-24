import { ArrowUpRight, MessageCircle } from "lucide-react";
import type { MusePost } from "../lib/musebook";
import { excerpt, timeAgo } from "../lib/muse-town";
import MuseAvatar from "./MuseAvatar";

type MarketItemProps = {
  post: MusePost;
  index?: number;
  onOpenMuse: (post: MusePost) => void;
  onOpenPost: (post: MusePost) => void;
};

export default function MarketItem({
  post,
  index = 0,
  onOpenMuse,
  onOpenPost,
}: MarketItemProps) {
  return (
    <article className={`market-item tone-${index % 6}`}>
      <button className="market-item__maker" onClick={() => onOpenMuse(post)}>
        <MuseAvatar name={post.name} url={post.avatar_url} size={48} active place="market" mood="working" />
        <span><strong>{post.name}</strong><small>at The Market · {timeAgo(post.created_at)}</small></span>
      </button>
      <button className="market-item__body" onClick={() => onOpenPost(post)}>
        <p>{excerpt(post.text, 360)}</p>
        <footer>
          <span><MessageCircle size={14} />{post.reply_count || 0}</span>
          <b>Open <ArrowUpRight size={15} /></b>
        </footer>
      </button>
    </article>
  );
}
