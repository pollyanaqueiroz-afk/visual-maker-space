-- Insert missing briefing_reviews for all completed images without reviews
INSERT INTO briefing_reviews (briefing_image_id, action, reviewed_by, reviewer_comments)
SELECT bi.id, 'approved', 'sistema@curseduca.com', 'Aprovação retroativa - correção de sincronização'
FROM briefing_images bi
WHERE bi.status = 'completed'
AND NOT EXISTS (
  SELECT 1 FROM briefing_reviews brev WHERE brev.briefing_image_id = bi.id AND brev.action = 'approved'
);

-- Update parent requests where ALL images are completed
UPDATE briefing_requests br
SET status = 'completed', updated_at = now()
WHERE br.status != 'completed'
AND NOT EXISTS (
  SELECT 1 FROM briefing_images bi WHERE bi.request_id = br.id AND bi.status != 'completed'
)
AND EXISTS (
  SELECT 1 FROM briefing_images bi2 WHERE bi2.request_id = br.id
)