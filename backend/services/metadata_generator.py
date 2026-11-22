import re
from typing import Dict, Any, List, Optional

class MetadataGeneratorService:
    @staticmethod
    def clean_title_topic(stream_title: str) -> str:
        """Extracts clean topic / game name from a stream title."""
        # Remove common stream tags like [LIVE], (STREAM), | 1080p, etc.
        cleaned = re.sub(r'\[.*?\]|\(.*?\)', '', stream_title)
        parts = re.split(r'[-–—|:]', cleaned)
        if parts:
            first_part = parts[0].strip()
            if len(first_part) > 3:
                return first_part[:35]
        return stream_title[:35].strip()

    @classmethod
    def generate_metadata_for_clip(
        cls,
        clip_category: str,
        stream_title: str,
        channel_name: str,
        transcript_snippet: str = "",
        clip_duration: float = 30.0,
        custom_templates: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Generates YouTube Shorts metadata:
        - Title: Natural, punchy, under 70 chars, avoids clickbait & all-caps spam.
        - Description: Engaging summary + respectful source creator attribution.
        - Hashtags: Relevant gaming & Shorts tags.
        - Caption: Social media short copy.
        - CategoryId: '20' (Gaming on YouTube).
        """
        templates = custom_templates or {}
        topic = cls.clean_title_topic(stream_title)
        clean_channel = channel_name or "Original Creator"

        # 1. Determine Title Based on Category & Dialogue
        category_lower = clip_category.lower()
        base_title = ""

        if "reaction" in category_lower:
            base_title = f"The Best Reaction in {topic}"
        elif "clutch" in category_lower:
            base_title = f"Unbelievable Clutch Play! | {topic}"
        elif "funny" in category_lower:
            base_title = f"You Won't Believe What Happened 😂 | {topic}"
        elif "energy" in category_lower:
            base_title = f"Peak Streamer Excitement! | {topic}"
        elif "rage" in category_lower:
            base_title = f"When the Game Goes Wrong! | {topic}"
        else:
            base_title = f"Incredible Stream Moment | {topic}"

        # If custom template provided:
        if templates.get("title_template"):
            tpl = templates["title_template"]
            base_title = tpl.replace("{topic}", topic).replace("{title}", topic).replace("{category}", clip_category).replace("{channel}", clean_channel)

        # STRICT YOUTUBE SHORTS REQUIREMENT:
        # YouTube Data API requires '#Shorts' in title/description to index into the Shorts shelf.
        base_title = base_title.strip()
        if "#shorts" not in base_title.lower():
            if len(base_title) > 65:
                base_title = base_title[:62].strip() + "..."
            title = f"{base_title} #Shorts"
        else:
            if len(base_title) > 75:
                title = base_title[:72].strip() + "..."
            else:
                title = base_title

        # 2. Generate Description
        desc_lines = [
            f"#Shorts Catch this highlight from {topic}!",
            "",
            f"🎮 Stream: {stream_title}",
            f"👤 Creator: {clean_channel}",
            "",
            "Enjoyed the clip? Subscribe for daily gaming highlights and clips!",
            "",
            "#Shorts #Gaming #Highlights #Clips"
        ]

        if templates.get("description_template"):
            tpl_desc = templates["description_template"]
            desc_text = tpl_desc.replace("{topic}", topic).replace("{channel}", clean_channel).replace("{stream_title}", stream_title)
        else:
            desc_text = "\n".join(desc_lines)

        # 3. Generate Clean Hashtags
        hashtags = ["#Shorts", "#Gaming", "#Clip", "#Highlights"]
        clean_topic_tag = "#" + re.sub(r'[^a-zA-Z0-9]', '', topic)
        if len(clean_topic_tag) > 2 and clean_topic_tag not in hashtags:
            hashtags.append(clean_topic_tag)

        # 4. Generate Short Caption
        caption = f"Insane moment on {clean_channel}'s stream! 🔥 {title}"

        return {
            "title": title,
            "description": desc_text,
            "hashtags": hashtags,
            "caption": caption,
            "category_id": "20",  # YouTube Gaming
            "privacy_status": templates.get("privacy_status", "public"),
        }
