import { doc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AppStateManager } from "./storage";
import { Member } from "../types";

const COOLDOWNS = {
  VISIT: 60 * 60 * 1000, // 1 hour
  SEARCH: 60 * 60 * 1000, // 1 hour
  PROFILE: 24 * 60 * 60 * 1000, // 1 day
  AI: 60 * 60 * 1000, // 1 hour
  NEWS: 10 * 60 * 1000, // 10 minutes
  MEDIA: 0, // No cooldown
  RSVP: 0, // No cooldown
};

export class EngagementTracker {
  private static checkCooldown(actionKey: string, cooldownMs: number): boolean {
    const lastTimeStr = localStorage.getItem(`engagement_last_${actionKey}`);
    const now = Date.now();
    
    if (lastTimeStr) {
      const lastTime = parseInt(lastTimeStr, 10);
      if (now - lastTime < cooldownMs) {
        return false; // on cooldown
      }
    }
    
    localStorage.setItem(`engagement_last_${actionKey}`, now.toString());
    return true;
  }

  private static async awardPoints(memberId: string, points: number, actionName: string) {
    if (!memberId || points <= 0) return;
    
    try {
      const memberRef = doc(db, "members", memberId);
      const memberDoc = await getDoc(memberRef);
      
      if (memberDoc.exists()) {
        const currentData = memberDoc.data();
        const newPoints = (currentData.activityPoints || 0) + points;
        
        await updateDoc(memberRef, { 
          activityPoints: increment(points) 
        });

        // Sync to AppStateManager local memory
        const members = AppStateManager.getMembers();
        const memIdx = members.findIndex(m => m.id === memberId);
        if (memIdx !== -1) {
          members[memIdx].activityPoints = newPoints;
          AppStateManager.saveMembers(members);
        }
        
        console.log(`[EngagementTracker] Awarded +${points} pts to ${memberId} for ${actionName}.`);
      }
    } catch (err) {
      console.warn(`[EngagementTracker] Failed to award points:`, err);
    }
  }

  static async trackVisit(memberId?: string) {
    if (!memberId) return;
    if (this.checkCooldown('visit', COOLDOWNS.VISIT)) {
      await this.awardPoints(memberId, 5, 'App Visits');
    }
  }

  static async trackSearch(memberId?: string) {
    if (!memberId) return;
    if (this.checkCooldown('search', COOLDOWNS.SEARCH)) {
      await this.awardPoints(memberId, 10, 'Search Directories');
    }
  }

  static async trackProfileUpdate(memberId?: string) {
    if (!memberId) return;
    if (this.checkCooldown('profile', COOLDOWNS.PROFILE)) {
      await this.awardPoints(memberId, 50, 'Profile Updates');
    }
  }

  static async trackAiResearch(memberId?: string) {
    if (!memberId) return;
    if (this.checkCooldown('ai', COOLDOWNS.AI)) {
      await this.awardPoints(memberId, 10, 'AI Research');
    }
  }

  static async trackMediaUpload(memberId?: string) {
    if (!memberId) return;
    await this.awardPoints(memberId, 20, 'Media Uploads');
  }

  static async trackNewsRead(memberId?: string) {
    if (!memberId) return;
    if (this.checkCooldown('news', COOLDOWNS.NEWS)) {
      await this.awardPoints(memberId, 10, 'Reading News');
    }
  }

  static async trackRsvp(memberId?: string) {
    if (!memberId) return;
    await this.awardPoints(memberId, 20, 'RSVPs');
  }
}
