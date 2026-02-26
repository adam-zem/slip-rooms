// src/pages/SupportPage.jsx
import { Link } from "react-router-dom";
import "./SupportPage.css";

export default function SupportPage() {
  return (
    <div className="support-page">
      <div className="support-container">
        <header className="support-header">
          <Link to="/" className="support-logo">
            <span className="logo-text">SlipRooms</span>
          </Link>
          <h1>Support Center</h1>
          <p className="support-subtitle">We're here to help you have a safe and enjoyable experience</p>
        </header>

        {/* Contact Section */}
        <section className="support-section">
          <h2>Contact Us</h2>
          <div className="contact-card">
            <div className="contact-icon">📧</div>
            <div className="contact-info">
              <h3>Email Support</h3>
              <p>For any questions, concerns, or issues, reach out to us at:</p>
              <a href="mailto:support@sliprooms.com" className="contact-email">
                support@sliprooms.com
              </a>
              <p className="response-time">We typically respond within 24-48 hours</p>
            </div>
          </div>
        </section>

        {/* How to Report Content */}
        <section className="support-section">
          <h2>How to Report Content</h2>
          <p>If you encounter inappropriate content or behavior, you can report it directly in the app:</p>
          <div className="steps-list">
            <div className="step">
              <span className="step-number">1</span>
              <div className="step-content">
                <h4>In Chat Rooms</h4>
                <p>Long-press on any message to open the action menu, then tap the <strong>Report</strong> button (flag icon).</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <div className="step-content">
                <h4>On Posts</h4>
                <p>Tap the <strong>Report</strong> button (flag icon) below any post to report it.</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <div className="step-content">
                <h4>On User Profiles</h4>
                <p>Visit the user's profile and tap the <strong>Report</strong> button to report the user.</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">4</span>
              <div className="step-content">
                <h4>Select a Reason</h4>
                <p>Choose the appropriate reason for your report (harassment, spam, hate speech, etc.) and submit.</p>
              </div>
            </div>
          </div>
          <p className="report-note">All reports are reviewed by our moderation team. False reports may result in action against your account.</p>
        </section>

        {/* How to Block Users */}
        <section className="support-section">
          <h2>How to Block Users</h2>
          <p>If you want to stop seeing content from a specific user, you can block them:</p>
          <div className="steps-list">
            <div className="step">
              <span className="step-number">1</span>
              <div className="step-content">
                <h4>From Their Profile</h4>
                <p>Visit the user's profile and tap the <strong>Block</strong> button (ban icon).</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <div className="step-content">
                <h4>From Messages or Posts</h4>
                <p>Long-press on any message or tap the block button on any post to block that user.</p>
              </div>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <div className="step-content">
                <h4>After Reporting</h4>
                <p>When you report content, you'll be prompted to also block the user if desired.</p>
              </div>
            </div>
          </div>
          <div className="info-box">
            <h4>What happens when you block someone?</h4>
            <ul>
              <li>You won't see their posts, messages, or content</li>
              <li>They cannot send you direct messages</li>
              <li>They are removed from your friends list</li>
              <li>You can unblock users anytime in Settings → Blocked Users</li>
            </ul>
          </div>
        </section>

        {/* Community Guidelines */}
        <section className="support-section">
          <h2>Community Guidelines</h2>
          <p>SlipRooms is committed to maintaining a safe and respectful community. All users must follow these guidelines:</p>

          <div className="guidelines-grid">
            <div className="guideline-card prohibited">
              <div className="guideline-icon">🚫</div>
              <h4>No Harassment</h4>
              <p>Do not bully, intimidate, or repeatedly target other users. Respect others' boundaries.</p>
            </div>

            <div className="guideline-card prohibited">
              <div className="guideline-icon">🚫</div>
              <h4>No Hate Speech</h4>
              <p>Content that promotes hatred against individuals or groups based on race, ethnicity, religion, gender, sexual orientation, disability, or other characteristics is strictly prohibited.</p>
            </div>

            <div className="guideline-card prohibited">
              <div className="guideline-icon">🚫</div>
              <h4>No Spam</h4>
              <p>Do not post repetitive content, advertisements, or promotional material. Avoid flooding chat rooms with messages.</p>
            </div>

            <div className="guideline-card prohibited">
              <div className="guideline-icon">🚫</div>
              <h4>No Explicit Content</h4>
              <p>Sexually explicit content, nudity, and pornographic material are not allowed anywhere on the platform.</p>
            </div>

            <div className="guideline-card prohibited">
              <div className="guideline-icon">🚫</div>
              <h4>No Threats or Violence</h4>
              <p>Threats of violence, encouraging self-harm, or any content promoting dangerous activities is prohibited.</p>
            </div>

            <div className="guideline-card prohibited">
              <div className="guideline-icon">🚫</div>
              <h4>No Impersonation</h4>
              <p>Do not pretend to be another person, brand, or organization. Use your authentic identity.</p>
            </div>
          </div>

          <div className="guidelines-enforcement">
            <h4>Enforcement</h4>
            <p>Violations of these guidelines may result in:</p>
            <ul>
              <li>Content removal</li>
              <li>Temporary muting</li>
              <li>Account suspension</li>
              <li>Permanent ban</li>
            </ul>
            <p>We have a <strong>zero-tolerance policy</strong> for severe violations including threats, hate speech, and explicit content.</p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="support-section">
          <h2>Frequently Asked Questions</h2>

          <div className="faq-list">
            <details className="faq-item">
              <summary>How do I create an account?</summary>
              <p>Download the SlipRooms app from the App Store or Google Play, then sign up with your email address or use Sign in with Apple/Google. You'll need to choose a unique username to get started.</p>
            </details>

            <details className="faq-item">
              <summary>How do I change my username or profile?</summary>
              <p>Go to your profile by tapping your avatar, then tap the settings icon. From there you can update your display name, bio, avatar, and other profile settings.</p>
            </details>

            <details className="faq-item">
              <summary>How do I join a chat room?</summary>
              <p>Browse available rooms by sport category on the home screen. Tap any room to join and start chatting with other fans.</p>
            </details>

            <details className="faq-item">
              <summary>How do I send a direct message?</summary>
              <p>Tap on any user's profile and select "Send Message" to start a private conversation. You can also access your DMs from the messages icon in the navigation.</p>
            </details>

            <details className="faq-item">
              <summary>How do I add friends?</summary>
              <p>Visit a user's profile and tap "Add Friend" to send a friend request. Once they accept, you'll be connected and can easily find each other.</p>
            </details>

            <details className="faq-item">
              <summary>Can I delete my account?</summary>
              <p>Yes. Go to Settings and scroll to the bottom to find the "Delete Account" option. This action is permanent and will remove all your data.</p>
            </details>

            <details className="faq-item">
              <summary>What should I do if I'm being harassed?</summary>
              <p>Block the user immediately to stop seeing their content. Then report them using the in-app report feature. Contact us at support@sliprooms.com if the harassment continues.</p>
            </details>

            <details className="faq-item">
              <summary>How do I unblock someone?</summary>
              <p>Go to Settings → Blocked Users to see your blocked list. Tap "Unblock" next to any user you want to unblock.</p>
            </details>

            <details className="faq-item">
              <summary>Is the app free to use?</summary>
              <p>Yes, SlipRooms is free to download and use. We may introduce optional premium features in the future.</p>
            </details>

            <details className="faq-item">
              <summary>How do I report a bug or suggest a feature?</summary>
              <p>Email us at support@sliprooms.com with details about the bug or your feature suggestion. We appreciate all feedback!</p>
            </details>
          </div>
        </section>

        {/* Footer */}
        <footer className="support-footer">
          <div className="footer-links">
            <Link to="/">Home</Link>
            <span className="divider">·</span>
            <a href="/privacy">Privacy Policy</a>
            <span className="divider">·</span>
            <a href="/terms">Terms of Service</a>
            <span className="divider">·</span>
            <a href="mailto:support@sliprooms.com">Contact</a>
          </div>
          <p className="copyright">© {new Date().getFullYear()} SlipRooms. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
