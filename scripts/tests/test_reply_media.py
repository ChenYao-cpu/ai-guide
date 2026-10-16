import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import BackgroundTasks
from server.base.models.tour_models import TourChatItem
from server.base.modules import reply_media


class NormalSpeechTests(unittest.IsolatedAsyncioTestCase):
    def test_legacy_slow_parameter_is_ignored_not_exposed_as_an_option(self):
        item = TourChatItem(sessionId=1, speech_rate=0.8)
        self.assertNotIn('speech_rate', item.model_dump())
        self.assertNotIn('speech_rate', TourChatItem.model_json_schema()['properties'])

    async def test_xingyun_keeps_native_voice_without_local_synthesis(self):
        with patch('server.base.modules.edge_tts_client.synthesize_speech', new_callable=AsyncMock) as synthesize:
            result = await reply_media.prepare_reply_media(
                {'voice_style': 'male_wenhou'}, 1, 2, '你好', 'xingyun', 'zh', BackgroundTasks())
        synthesize.assert_not_awaited()
        self.assertEqual(result, dict(ttsAudioUrl='', avatarJob=None, avatarPerformance=None))

    async def test_local_audio_keeps_selected_voice_at_normal_speed(self):
        with tempfile.TemporaryDirectory() as temporary:
            audio = Path(temporary) / 'normal.wav'
            audio.write_bytes(b'test-audio')
            config = SimpleNamespace(SERVER_FILE_ROOT=temporary, TOUR_FILE_DIR='tour_files')
            with patch.object(reply_media, 'WEB_CONFIGS', config), \
                 patch.object(reply_media, 'API_CONFIG', SimpleNamespace(REQUEST_FILES_URL='/api/v1/files')), \
                 patch('server.base.modules.edge_tts_client.synthesize_speech', new_callable=AsyncMock, return_value=str(audio)) as synthesize:
                result = await reply_media.prepare_reply_media(
                    {'voice_style': 'male_wenhou'}, 1, 2, 'Hello', 'audio', 'en', BackgroundTasks())
            self.assertEqual(synthesize.await_args.kwargs['speed'], 1.0)
            self.assertEqual(synthesize.await_args.kwargs['voice_style'], 'male_wenhou')
            self.assertEqual(synthesize.await_args.kwargs['language'], 'en')
            self.assertEqual(result['ttsAudioUrl'], '/api/v1/files/tour_files/tts/normal.wav')


if __name__ == '__main__':
    unittest.main()
